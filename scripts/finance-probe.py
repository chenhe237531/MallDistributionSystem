#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""金融边界探测：下单金额篡改 / 防超退 / merchant 行退款冲回 / 负票证 / 对账汇总一致性"""
import json, urllib.request, urllib.error, sys
import subprocess, os, re

API = 'http://localhost:3000/api'
DB = ['docker', 'exec', 'mall-postgres', 'psql', '-U', 'mall', '-d', 'mall', '-tAc']

# 按 apps/api/.env 的 DATABASE_URL 自动识别数据库方言（SQLite epoch 毫秒 / Postgres 原生时间戳）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_URL = ''
_env = os.path.join(ROOT, 'apps', 'api', '.env')
if os.path.exists(_env):
    for _line in open(_env):
        m = re.match(r'\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?', _line)
        if m:
            DB_URL = m.group(1).strip()
            break
IS_SQLITE = 'file:' in DB_URL or 'sqlite' in DB_URL
SQLITE_DB = os.path.normpath(os.path.join(ROOT, 'apps', 'api', 'prisma', 'dev.db'))
# 兼容不同容器名
def try_psql():
    candidates = (
        ('mall-distribution-db', 'mall', 'mall_distribution'),
        ('mall-postgres', 'mall', 'mall'),
        ('postgres', 'postgres', 'mall'),
    )
    for container, user, db in candidates:
        cmd = ['docker', 'exec', container, 'psql', '-U', user, '-d', db, '-tAc', 'SELECT 1']
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                return ['docker', 'exec', container, 'psql', '-U', user, '-d', db, '-tAc']
        except Exception:
            continue
    return None

results = []
def check(name, cond, detail=''):
    tag = 'PASS' if cond else 'FAIL'
    results.append((name, tag))
    print(f"[{tag}] {name}" + (f"  -> {detail}" if (detail and not cond) else ''))

def req(method, path, token=None, body=None):
    r = urllib.request.Request(f'{API}{path}', method=method)
    if token: r.add_header('Authorization', f'Bearer {token}')
    data = json.dumps(body).encode() if body is not None else None
    if data: r.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(r, data=data, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def sql(query):
    if IS_SQLITE:
        r = subprocess.run(['sqlite3', SQLITE_DB, query], capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            raise RuntimeError(f'sql 失败: {r.stderr[:200]}')
        return r.stdout.strip()
    psql = try_psql()
    if not psql:
        raise RuntimeError('找不到可用的 postgres 容器，请确认 docker compose 服务名')
    r = subprocess.run(psql + [query], capture_output=True, text=True, timeout=15)
    if r.returncode != 0:
        raise RuntimeError(f'sql 失败: {r.stderr[:200]}')
    return r.stdout.strip()

PT = req('POST', '/auth/login', body={'phone': '13800000000', 'password': 'Admin@123'})[1]['token']
MT = req('POST', '/auth/login', body={'phone': '13900000001', 'password': 'Merchant@123'})[1]['token']
PT2 = req('POST', '/auth/login', body={'phone': '13900000011', 'password': 'Partner@123'})[1]['token']

# ---------- 准备：C 端账号 + 带渠道码订单（数量 2） ----------
import time as _t
phone = f'139{int(_t.time()) % 100000000:08d}'
s, b = req('POST', '/auth/register', body={'phone': phone, 'password': 'Probe@123', 'name': '探测客户', 'deviceId': 'probe'})
CT = b.get('token') if isinstance(b, dict) else None
req('PATCH', '/customers/me/real-name', CT, {'realName': '探测客户', 'idCardNo': '110101199003091237'})

chan = sql("SELECT code FROM \"ChannelIdentity\" WHERE status='active' AND type='partner' ORDER BY \"createdAt\" DESC LIMIT 1")
s, sf = req('GET', f'/sales-orders/storefront?channelCode={chan}')
listing = sf[0] if isinstance(sf, list) and sf else None
check('P0-prep 准备：渠道码与在售商品', bool(CT and chan and listing))

# 为探测商品配置一级 8% / 二级 4% 佣金规则（幂等，已存在则忽略失败）
PID = listing['productId']
req('POST', '/commissions/rules', PT, {'productId': PID, 'level': 1, 'rateType': 'percentage', 'rateBps': 800, 'effectiveFrom': '2026-01-01T00:00:00.000Z'})
req('POST', '/commissions/rules', PT, {'productId': PID, 'level': 2, 'rateType': 'percentage', 'rateBps': 400, 'effectiveFrom': '2026-01-01T00:00:00.000Z'})

s, order = req('POST', '/sales-orders', CT, {'items': [{'listingId': listing['listingId'], 'quantity': 2}], 'contactName': '探测客户', 'contactPhone': phone, 'channelCode': chan})
OID = order.get('id'); TOTAL = order.get('totalAmountCents')
check('P0-prep 下单成功（数量2）', s in (200, 201) and bool(OID), str(order)[:150])

# ---------- 探测 A：支付金额篡改（强制等于应付） ----------
s1, b1 = req('POST', f'/sales-orders/{OID}/register-payment', MT, {'paidAmountCents': TOTAL + 100})
check('A1 超额登记支付被拒', s1 >= 400, f'status={s1} {str(b1)[:100]}')
s2, b2 = req('POST', f'/sales-orders/{OID}/register-payment', MT, {'paidAmountCents': 1})
check('A2 低额登记支付被拒（必须等于应付）', s2 >= 400, f'status={s2} {str(b2)[:100]}')
s, od = req('GET', f'/sales-orders/{OID}', CT)
check('A2b 篡改尝试后订单仍为待支付', od.get('status') == 'pending_payment', str(od.get('status')))
s3, b3 = req('POST', f'/sales-orders/{OID}/register-payment', MT, {'paidAmountCents': TOTAL})
check('A3 足额登记支付成功', s3 in (200, 201), f'status={s3} {str(b3)[:100]}')

s, od = req('POST', f'/sales-orders/{OID}/ship', MT, {})
s, od = req('POST', f'/sales-orders/{OID}/deliver', MT, {})
check('P0-prep 发货送达完成', s in (200, 201), str(od)[:120])

# ---------- 数据准备：完成时间回拨 8 天 + 佣金时间回拨到上月，触发确认与对账 ----------
# SQLite：Prisma 以 epoch 毫秒存 DateTime；Postgres：原生时间戳方言
if IS_SQLITE:
    sql(f"UPDATE \"SalesOrder\" SET \"completedAt\"=(strftime('%s','now')-8*86400)*1000, \"paidAt\"=strftime('%s','2026-09-10 10:00:00')*1000 WHERE id='{OID}'")
    sql(f"UPDATE \"Commission\" SET \"createdAt\"=strftime('%s','2026-09-10 10:05:00')*1000 WHERE \"orderId\"='{OID}'")
else:
    sql(f"UPDATE \"SalesOrder\" SET \"completedAt\"=NOW() - INTERVAL '8 days', \"paidAt\"='2026-09-10 10:00:00+00' WHERE id='{OID}'")
    sql(f"UPDATE \"Commission\" SET \"createdAt\"='2026-09-10 10:05:00+00' WHERE \"orderId\"='{OID}'")
s, b = req('POST', '/commissions/confirm-eligible', PT, {})
check('P0-prep 佣金确认（售后保护期满）', s in (200, 201), str(b)[:120])

# ---------- 生成上月对账单（partner + merchant） ----------
# 清理历史探测对账单，保证每轮从干净状态开始（退款冲回行随级联/显式删除）
sql("DELETE FROM \"StatementLine\" WHERE \"statementId\" IN (SELECT id FROM \"Statement\" WHERE period='2026-09')")
sql("DELETE FROM \"StatementVoucher\" WHERE \"statementId\" IN (SELECT id FROM \"Statement\" WHERE period='2026-09')")
sql("DELETE FROM \"StatementDifference\" WHERE \"statementId\" IN (SELECT id FROM \"Statement\" WHERE period='2026-09')")
sql("DELETE FROM \"Statement\" WHERE period='2026-09'")
partner_id = sql(f"SELECT ci.\"userId\" FROM \"ChannelIdentity\" ci WHERE ci.code='{chan}'")
merchant_id = sql("SELECT id FROM \"User\" WHERE phone='13900000001'")
s, ps_before = req('POST', '/statements/generate', PT, {'period': '2026-09', 'subjectType': 'partner', 'subjectId': partner_id})
if s >= 400:  # 已存在则取现有
    _, sts = req('GET', '/statements?period=2026-09', PT)
    ps_before = next((x for x in sts if x['subjectType'] == 'partner' and x['subjectId'] == partner_id), None)
s, ms_before = req('POST', '/statements/generate', PT, {'period': '2026-09', 'subjectType': 'merchant', 'subjectId': merchant_id})
if s >= 400:
    _, sts = req('GET', '/statements?period=2026-09', PT)
    ms_before = next((x for x in sts if x['subjectType'] == 'merchant' and x['subjectId'] == merchant_id), None)
check('P0-prep 生成 partner/merchant 对账单', bool(ps_before and ms_before), f'{str(ps_before)[:80]} / {str(ms_before)[:80]}')
ps_id, ms_id = ps_before.get('id'), ms_before.get('id')
ps_pay0, ms_pay0 = ps_before.get('totalPayableCents'), ms_before.get('totalPayableCents')
check('B0 两份对账单应付均含本单佣金/收入', ps_pay0 > 0 and ms_pay0 > 0, f'partner={ps_pay0} merchant={ms_pay0}')

# ---------- 探测 B：部分退款 → 双向冲回 ----------
s, od = req('GET', f'/sales-orders/{OID}', CT)
item_id = od['items'][0]['id']
s, rf = req('POST', f'/sales-orders/{OID}/refund', MT, {'items': [{'orderItemId': item_id, 'quantity': 1}], 'reason': '金融探测部分退款'})
check('B1 部分退款受理（2 退 1）', s in (200, 201), str(rf)[:150])

s, ps_after = req('GET', f'/statements/{ps_id}', PT)
s, ms_after = req('GET', f'/statements/{ms_id}', PT)
partner_adj = [l for l in ps_after['lines'] if l['sourceType'] == 'refund_adjustment']
merchant_adj = [l for l in ms_after['lines'] if l['sourceType'] == 'refund_adjustment']
check('B2 partner 对账单出现佣金冲回调整行', len(partner_adj) > 0, str([l['amountCents'] for l in partner_adj]))
check('B3 merchant 对账单出现商家收入冲回调整行', len(merchant_adj) > 0, str([l['amountCents'] for l in merchant_adj]))
check('B4 partner 应付下降且与调整行一致',
      ps_after['totalPayableCents'] == ps_after['openingUnsettledCents'] + ps_after['newPayableCents'] + ps_after['adjustmentCents'] and ps_after['adjustmentCents'] < 0,
      f"payable {ps_pay0}->{ps_after['totalPayableCents']} adj={ps_after['adjustmentCents']}")
check('B5 merchant 应付下降且与调整行一致',
      ms_after['totalPayableCents'] == ms_after['openingUnsettledCents'] + ms_after['newPayableCents'] + ms_after['adjustmentCents'] and ms_after['adjustmentCents'] < 0,
      f"payable {ms_pay0}->{ms_after['totalPayableCents']} adj={ms_after['adjustmentCents']}")
# 冲回比例一致性：partner 行只含一级佣金，冲回 = 一级佣金金额 × 退款比例(1/2)
comm_refund = sum(l['amountCents'] for l in partner_adj)
merch_refund = sum(l['amountCents'] for l in merchant_adj)
s, cms = req('GET', f'/commissions/order/{OID}', MT)
l1_amount = next((c['amountCents'] for c in cms if c['level'] == 1), 0)
expect_comm = -round(l1_amount / 2)
check('B6 佣金冲回额 = 一级佣金 × 退款比例(1/2)', comm_refund == expect_comm, f'{comm_refund} vs {expect_comm} (l1={l1_amount})')

# ---------- 探测 C：防超退 ----------
s, rf2 = req('POST', f'/sales-orders/{OID}/refund', MT, {'items': [{'orderItemId': item_id, 'quantity': 2}], 'reason': '超退探测'})
check('C1 退款数量超剩余被拒（剩1退2）', s >= 400, f'status={s} {str(rf2)[:100]}')
s, rf3 = req('POST', f'/sales-orders/{OID}/refund', MT, {'items': [{'orderItemId': item_id, 'quantity': 1}], 'reason': '退完剩余'})
check('C2 剩余数量退完成功', s in (200, 201), f'status={s} {str(rf3)[:100]}')
s, rf4 = req('POST', f'/sales-orders/{OID}/refund', MT, {'items': [{'orderItemId': item_id, 'quantity': 1}], 'reason': '已全退再退'})
check('C3 全额退款后再次退款被拒', s >= 400, f'status={s} {str(rf4)[:100]}')
s, od = req('GET', f'/sales-orders/{OID}', CT)
check('C4 累计退款额不超过实付', od['refundedAmountCents'] <= od['paidAmountCents'], f"refund={od['refundedAmountCents']} paid={od['paidAmountCents']}")
ps_after2 = req('GET', f'/statements/{ps_id}', PT)[1]
ms_after2 = req('GET', f'/statements/{ms_id}', PT)[1]
check('C5 全退后佣金全额冲回（净额归零）',
      sum(l['amountCents'] for l in ps_after2['lines'] if l['sourceType'] == 'refund_adjustment') == -sum(l['amountCents'] for l in ps_after2['lines'] if l['sourceType'] == 'commission'),
      f"adj={sum(l['amountCents'] for l in ps_after2['lines'] if l['sourceType']=='refund_adjustment')}")
check('C6 全退后商家收入全额冲回',
      sum(l['amountCents'] for l in ms_after2['lines'] if l['sourceType'] == 'refund_adjustment') == -sum(l['amountCents'] for l in ms_after2['lines'] if l['sourceType'] == 'order_settlement'),
      f"adj={sum(l['amountCents'] for l in ms_after2['lines'] if l['sourceType']=='refund_adjustment')}")

# ---------- 探测 D：票证边界 ----------
voucher = f'PROBE-{int(_t.time())}'
s, b = req('POST', f'/statements/{ms_id}/vouchers', MT, {'voucherNo': voucher, 'title': 'x', 'amountCents': 0, 'issuedAt': '2026-09-20T00:00:00.000Z'})
check('D1 零额票证被拒', s >= 400, f'status={s} {str(b)[:100]}')
s, b = req('POST', f'/statements/{ms_id}/vouchers', MT, {'voucherNo': voucher + 'b', 'title': 'x', 'amountCents': -100, 'issuedAt': '2026-09-20T00:00:00.000Z'})
check('D2 负额票证被拒', s >= 400, f'status={s} {str(b)[:100]}')
# 重复结清保护：未对账不可结清；已结清不可重复结清
s1, b = req('POST', f'/statements/{ps_id}/settle', PT, {})
s, b = req('POST', f'/statements/{ps_id}/settle', PT, {})
check('D3 未对账/已结清不可重复结清', s1 >= 400 or s >= 400, f'first={s1} second={s}')

# ---------- 汇总 ----------
fails = [n for n, t in results if t == 'FAIL']
print(f"\n========== 汇总 ==========")
print(f"总断言 {len(results)} 项，失败 {len(fails)} 项")
if fails:
    for n in fails: print(f"  ✗ {n}")
    sys.exit(1)
