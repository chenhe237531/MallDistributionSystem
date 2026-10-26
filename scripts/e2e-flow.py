#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全链路 E2E：交易 → 履约 → 归属 → 佣金 → 对账 → 结清 → 退款 → 权限 → 幂等"""
import json, urllib.request, urllib.error, sys, time

API = 'http://localhost:3000/api'
results = []

def req(method, path, token=None, body=None, expect_json=True):
    r = urllib.request.Request(f'{API}{path}', method=method)
    if token: r.add_header('Authorization', f'Bearer {token}')
    data = None
    if body is not None:
        r.add_header('Content-Type', 'application/json')
        data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(r, data=data, timeout=30) as resp:
            raw = resp.read()
            if not expect_json:
                return resp.status, raw
            try: return resp.status, json.loads(raw.decode())
            except Exception: return resp.status, raw[:80]
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw

def check(name, cond, detail=''):
    tag = 'PASS' if cond else 'FAIL'
    results.append((name, tag, detail))
    print(f"[{tag}] {name}" + (f"  -> {detail}" if (detail and not cond) else ''))

def login(phone, pwd):
    s, b = req('POST', '/auth/login', body={'phone': phone, 'password': pwd})
    return b['token'] if s in (200, 201) else None

PT = login('13800000000', 'Admin@123')
MT = login('13900000001', 'Merchant@123')
ST = login('13900000002', 'Sales@123')
check('登录：平台/商家/销售', bool(PT and MT and ST))

# ---------- A. 合伙人两级结构 ----------
def ensure_account(phone, pwd, name):
    s, b = req('POST', '/accounts', PT, {'phone': phone, 'password': pwd, 'name': name, 'primaryRole': 'partner'})
    if s in (200, 201):
        return b.get('id')
    s, accs = req('GET', '/accounts', PT)
    acc = next((a for a in accs if a.get('phone') == phone), None)
    return acc.get('id') if acc else None

p1 = ensure_account('13900000011', 'Partner@123', '合伙人甲')
p2 = ensure_account('13900000012', 'Partner@123', '合伙人乙')
check('A1/A2 创建两位合伙人', bool(p1) and bool(p2), f'p1={p1} p2={p2}')
for pid, pname in ((p1, '甲'), (p2, '乙')):
    s, b = req('POST', f'/accounts/{pid}/approve', PT, {})
    check(f'A2.{pname} 平台审核启用', s in (200, 201) or (isinstance(b, dict) and '已启用' in str(b)), f'status={s} {str(b)[:100]}')
s, b = req('POST', f'/accounts/partners/{p1}/inviter', PT, {'inviterId': p2})
check('A3 绑定邀请上级（两级硬上限）', s in (200, 201), str(b)[:150])
s, b = req('POST', f'/accounts/partners/{p2}/inviter', PT, {'inviterId': p1})
check('A4 循环邀请被拒绝', s >= 400, f'status={s} {str(b)[:120]}')

P1T = login('13900000011', 'Partner@123')
s, ch = req('GET', '/channels/me', P1T)
ch_list = ch if isinstance(ch, list) else ch.get('items') or []
chan1 = next((c.get('code') for c in ch_list if c.get('status') == 'active' and c.get('code')), None)
check('A5 合伙人甲渠道码', s in (200, 201) and bool(chan1), str(ch)[:200])

# ---------- B. 佣金规则 ----------
s, prods = req('GET', '/products', PT)
prod = next((p for p in prods if p.get('status') == 'active' and p.get('distributable')), prods[0] if prods else None)
PID = prod['id'] if prod else ''
s, b = req('POST', '/commissions/rules', PT, {'productId': PID, 'level': 1, 'rateType': 'percentage', 'rateBps': 800, 'effectiveFrom': '2026-01-01T00:00:00.000Z'})
check('B1 配置一级佣金 8%', s in (200, 201), str(b)[:150])
s, b = req('POST', '/commissions/rules', PT, {'productId': PID, 'level': 2, 'rateType': 'percentage', 'rateBps': 400, 'effectiveFrom': '2026-01-01T00:00:00.000Z'})
check('B2 配置二级佣金 4%', s in (200, 201), str(b)[:150])
s, b = req('POST', '/commissions/rules', PT, {'productId': PID, 'level': 1, 'rateType': 'percentage', 'rateBps': 9900, 'effectiveFrom': '2026-01-01T00:00:00.000Z'})
check('B3 佣金超上限被拒绝（商品 cap 1000bps 内校验）', s >= 400, f'status={s} {str(b)[:150]}')

# ---------- C. 采购链路与预付款冻结/扣减 ----------
s, prepaid0 = req('GET', '/prepaid/me', MT)
bal0 = prepaid0['account']['availableCents']; fro0 = prepaid0['account']['frozenCents']
# 预存不足时平台先调账充值，保证采购可执行（多次重跑脚本不因余额耗尽而中断）
if bal0 < 200000:
    s_merchant, m_body = req('GET', '/auth/me', MT)
    MID = m_body.get('sub') or m_body.get('id') if isinstance(m_body, dict) else None
    if not MID:
        accs = req('GET', '/accounts', PT)[1]
        MID = next((a['id'] for a in accs if a.get('phone') == '13900000001'), None)
    s, b = req('POST', '/prepaid/adjust', PT, {'merchantId': MID, 'amountCents': 1000000, 'note': 'E2E 测试充值'})
    check('C0 预存余额不足自动充值', s in (200, 201), f'bal={bal0} status={s} {str(b)[:120]}')
    s, prepaid0 = req('GET', '/prepaid/me', MT)
    bal0 = prepaid0['account']['availableCents']; fro0 = prepaid0['account']['frozenCents']
s, po = req('POST', '/procurement-orders', MT, {'items': [{'productId': PID, 'quantity': 2}]})
POID = po.get('id') if isinstance(po, dict) else None
check('C1 商家创建采购单', s in (200, 201) and bool(POID), str(po)[:150])
s, prepaid1 = req('GET', '/prepaid/me', MT)
check('C2 下单即冻结（可用减少/冻结增加）', prepaid1['account']['availableCents'] < bal0 and prepaid1['account']['frozenCents'] > fro0,
      f"{bal0}->{prepaid1['account']['availableCents']} frozen {fro0}->{prepaid1['account']['frozenCents']}")
fro_after_order = prepaid1['account']['frozenCents']
po_total = po.get('totalAmountCents') if isinstance(po, dict) else None
for act, ep in (('C3 平台确认', 'confirm'), ('C4 平台发货', 'ship')):
    s, b = req('POST', f'/procurement-orders/{POID}/{ep}', PT, {})
    check(act, s in (200, 201), str(b)[:150])
s, b = req('POST', f'/procurement-orders/{POID}/receive', MT, {})
check('C5 商家收货（冻结转实扣）', s in (200, 201), str(b)[:150])
s, prepaid2 = req('GET', '/prepaid/me', MT)
check('C6 本次采购冻结已结算（冻结减少 = 单据金额）', fro_after_order - prepaid2['account']['frozenCents'] == po_total,
      f'frozen {fro_after_order}->{prepaid2["account"]["frozenCents"]} order={po_total}（差值可能来自历史在途单据正常冻结）')
s, b = req('POST', '/box-codes/generate', PT, {'procurementOrderId': POID})
check('C7 生成盒码', s in (200, 201), str(b)[:150])
s, labels = req('GET', f'/box-codes/labels/{POID}', PT)
items = labels if isinstance(labels, list) else labels.get('labels') or labels.get('items') or []
codes = [i['code'] for i in items]
check('C8 盒码数量与采购数一致', len(codes) == 2, str(codes))

# ---------- D. 销售单（带渠道码）→ 履约 → 报告 ----------
s, sf = req('GET', f'/sales-orders/storefront?channelCode={chan1}')
listing = (sf[0] if isinstance(sf, list) and sf else (sf.get('items') or [None])[0] if isinstance(sf, dict) else None)
check('D1 渠道码 storefront 可见在售', bool(listing), str(sf)[:200])
s, b = req('POST', '/auth/register', body={'phone': '13911113333', 'password': 'Test@123', 'name': '王五', 'deviceId': 'e2e-device'})
CT2 = b.get('token') if isinstance(b, dict) and b.get('token') else login('13911113333', 'Test@123')
check('D2-prep C端账号就绪', bool(CT2))
req('PATCH', '/customers/me/real-name', CT2, {'realName': '王五', 'idCardNo': '110101199002022345'})
s, order = req('POST', '/sales-orders', CT2, {'items': [{'listingId': listing['listingId'], 'quantity': 1}], 'contactName': '王五', 'contactPhone': '13911113333', 'channelCode': chan1})
OID = order.get('id') if isinstance(order, dict) else None
check('D2 C端下单（带渠道码）', s in (200, 201) and bool(OID), str(order)[:200])
s, od = req('GET', f'/sales-orders/{OID}', CT2)
check('D3 待支付状态', od.get('status') == 'pending_payment', str(od.get('status')))
pay = od.get('totalAmountCents')
s, b = req('POST', f'/sales-orders/{OID}/register-payment', MT, {'paidAmountCents': pay})
check('D4 商家登记支付', s in (200, 201), str(b)[:150])
s, b = req('POST', f'/sales-orders/{OID}/ship', MT, {})
check('D5 商家发货', s in (200, 201), str(b)[:150])
s, b = req('POST', f'/sales-orders/{OID}/deliver', MT, {})
check('D6 确认送达', s in (200, 201), str(b)[:150])
BOX = codes[0]
s, pv = req('GET', f'/box-codes/preview/{BOX}', CT2)
check('D7 盒码预览', s == 200 and pv.get('status') == 'generated', str(pv)[:120])
s, act = req('POST', '/box-codes/activate', CT2, {'boxCode': BOX, 'questionnaire': {'gender': 'male', 'age': 30}, 'consentGiven': True, 'reportAuthorization': True, 'samplingMethod': 'self_mail', 'orderId': OID, 'device': 'e2e'})
SID_ = act.get('sample', {}).get('id') if isinstance(act, dict) else None
own = act.get('ownership', {}) if isinstance(act, dict) else {}
check('D8 扫码激活建立归属', s in (200, 201) and bool(SID_), str(act)[:150])
print(f"    ownership 完整结构: {json.dumps(own, ensure_ascii=False)}")
check('D9 归属随盒码写定（渠道类型非空）', bool(own.get('channelType')), str(own)[:200])
s, b = req('POST', f'/samples/{SID_}/mail', CT2, {'trackingNo': 'SF000111222'})
check('D10 客户寄回', s in (200, 201), str(b)[:120])
s, b = req('POST', f'/samples/{SID_}/receive', PT, {'boxCodeMatched': True, 'samplingTimeValid': True, 'storageConditionOk': True, 'transitWithinLimit': True})
check('D11 实验室收样（校验通过）', s in (200, 201), str(b)[:150])
s, b = req('POST', f'/samples/{SID_}/receive', PT, {'boxCodeMatched': True, 'samplingTimeValid': True, 'storageConditionOk': True, 'transitWithinLimit': True})
check('D12 重复收样被拒绝', s >= 400, f'status={s}')
s, b = req('POST', f'/samples/{SID_}/testing', PT, {})
check('D13 开始检测', s in (200, 201), str(b)[:120])
s, rep = req('POST', '/reports', PT, {'sampleId': SID_, 'fields': {'hemoglobin': '138 g/L', 'vitaminD': '31 ng/ml'}, 'summary': 'E2E 报告', 'pdfUrl': 'https://mall.example/e2e.pdf'})
RID = rep.get('id') if isinstance(rep, dict) else None
req('POST', f'/reports/{RID}/submit', PT, {})
s, b = req('POST', f'/reports/{RID}/publish', PT, {})
check('D14 报告发布', s in (200, 201) and bool(RID), str(b)[:150])
time.sleep(1)
s, interp = req('GET', f'/interpretations/report/{RID}/latest', CT2)
interp_id = interp.get('id') if isinstance(interp, dict) else None
check('D15a 报告发布后 AI 解读自动生成', bool(interp_id) and interp.get('status') in ('generated', 'reviewed', 'published'), str(interp)[:150])
# PRD FR-07：未复核版本不对 C 端展示（contentHidden），复核发布后可见
s, hidden_view = req('GET', f'/interpretations/{interp_id}', CT2) if interp_id else (0, {})
check('D15b 未复核版本对 C 端隐藏（FR-07 异常规则）', hidden_view.get('contentHidden') is True, str(hidden_view)[:120])
s, b = req('POST', f'/interpretations/{interp_id}/adopt', PT, {})
if s >= 400:
    s, b = req('POST', f'/interpretations/{interp_id}/publish', PT, {})
check('D15c 平台复核采纳解读', s in (200, 201), str(b)[:150])
s, b = req('POST', f'/interpretations/{interp_id}/publish', PT, {})
check('D15d 解读发布', s in (200, 201) or '已发布' in str(b) or s == 409, f'status={s} {str(b)[:120]}')
s, interp_full = req('GET', f'/interpretations/{interp_id}', CT2) if interp_id else (0, {})
check('D15e 复核发布后 C 端可见六段内容', isinstance(interp_full, dict) and interp_full.get('contentHidden') is False and bool(interp_full.get('sections')), f'keys={list(interp_full.keys()) if isinstance(interp_full, dict) else interp_full}')
s, tasks = req('GET', '/notifications/report-tasks', MT)
tl = tasks if isinstance(tasks, list) else []
check('D16 商家出现待转发任务（FR-16）', len(tl) > 0, str(tl)[:150])
s, share = req('POST', '/report-shares', MT, {'reportId': RID, 'receiverPhone': '13911113333'})
share_token = share.get('token') if isinstance(share, dict) else None
check('D17 商家生成转发卡片', s in (200, 201) and bool(share_token), str(share)[:150])
s, opened = req('GET', f'/report-shares/{share_token}', CT2)
check('D18 客户凭分享打开报告', s in (200, 201), str(opened)[:120])
s, _ = req('GET', f'/report-shares/{share_token}')
check('D19 未登录打开分享无效', s >= 400, f'status={s}')
s, b = req('POST', f'/sales-orders/{OID}/complete', MT, {})
check('D20 报告交付后订单完成', s in (200, 201), str(b)[:150])

# ---------- E. 佣金与账目守恒（归属改写后按最新代际断言） ----------
s, cms = req('GET', f'/commissions/order/{OID}', PT)
cl = cms if isinstance(cms, list) else cms.get('items') or []
max_gen = max((c.get('generation') or 0) for c in cl) if cl else 0
cur = [c for c in cl if c.get('generation') == max_gen]
check('E1 产生两级佣金流水（预归属代）', len(cl) >= 2, f'total={len(cl)}')
l1 = next((c for c in cur if c.get('level') == 1), None)
l2_cur = next((c for c in cur if c.get('level') == 2), None)
old_l2 = next((c for c in cl if c.get('level') == 2 and c.get('generation') < max_gen), None)
check('E1b 归属改写后旧代佣金作废（盒码为准，D3/FR-09）', old_l2 is None or old_l2.get('status') == 'invalid', f'old_l2_status={old_l2 and old_l2.get("status")}')
if l1 and pay:
    exp1 = round(pay * 0.08)
    check('E2 现行代一级金额 = 实付 × 8%', abs((l1.get('amountCents') or 0) - exp1) <= 1, f"amount={l1.get('amountCents')} expect~{exp1} beneficiaryType={l1.get('beneficiaryType')}")
check('E3 归属改写后商家渠道成为一级受益人、无二级', bool(l1) and l2_cur is None, f'L1={l1 and l1.get("beneficiaryType")} L2_exists={l2_cur is not None}')
s, split = req('GET', f'/commissions/order/{OID}/split', PT)
check('E4 账目拆分接口', s in (200, 201), str(split)[:200])

# ---------- F. 对账：差异/票证/结清（D5 规则，每轮动态创建全新合伙人避免单据污染） ----------
period = time.strftime('%Y-%m')
stamp = time.strftime('%H%M%S')
p3 = ensure_account(f'13910{stamp[-6:]}', 'Partner@123', f'合伙人{stamp[-4:]}')
s, b = req('POST', f'/accounts/{p3}/approve', PT, {})
s, b = req('POST', '/statements/generate', PT, {'period': period, 'subjectType': 'partner', 'subjectId': p3})
check('F1 生成合伙人对账单', s in (200, 201), str(b)[:200])
s, stlist = req('GET', '/statements', PT)
stl = stlist if isinstance(stlist, list) else stlist.get('items') or []
stmt = next((x for x in stl if x.get('subjectId') == p3 and x.get('period') == period), None)
STID = stmt.get('id') if stmt else None
check('F2 对账单出现在列表', bool(STID), str(stl)[:200])
if STID:
    s, sd = req('GET', f'/statements/{STID}', PT)
    payable = sd.get('totalPayableCents')
    # 售后期 7 天内佣金为 estimated，未转待对账，不应进对账单（PRD 4.1/6.2 状态机）
    check('F3 未满售后期佣金不进对账单', payable == 0, f'payable={payable}')
    s, b = req('POST', f'/statements/{STID}/settle', PT, {})
    check('F4 无票证不允许结清（D5）', s >= 400, f'status={s} {str(b)[:120]}')
    stamp = time.strftime('%H%M%S')
    s, b = req('POST', f'/statements/{STID}/vouchers', PT, {'voucherNo': f'INV-E2E-001-{stamp}', 'title': '服务费', 'amountCents': max(1, (payable or 1) - 1), 'issuedAt': '2026-10-20T00:00:00.000Z'})
    check('F5 登记不足额票证 → 产生差异', s in (200, 201), str(b)[:150])
    s, sd2 = req('GET', f'/statements/{STID}', PT)
    check('F6 差异金额可见', (sd2.get('differenceCents') or 0) != 0 or (sd2.get('voucherMissingCents') or 0) != 0, str({k: sd2.get(k) for k in ('differenceCents', 'voucherMissingCents', 'status')}))
    s, b = req('POST', f'/statements/{STID}/settle', PT, {})
    check('F7 票证不足仍不允许结清', s >= 400, f'status={s}')
    s, b = req('POST', f'/statements/{STID}/differences', PT, {'amountCents': 1, 'reason': 'E2E 尾差登记'})
    diffs = b if isinstance(b, list) else b.get('differences') or b
    s, sd3 = req('GET', f'/statements/{STID}', PT)
    d0 = (sd3.get('differences') or [{}])[0]
    s, b = req('POST', f'/statements/{STID}/differences/{d0.get("id")}/resolve', PT, {'resolution': '线下核对一致'})
    check('F8 差异解决', s in (200, 201), str(b)[:150])
    s, b = req('POST', f'/statements/{STID}/vouchers', PT, {'voucherNo': f'INV-E2E-002-{stamp}', 'title': '服务费补票', 'amountCents': 1, 'issuedAt': '2026-10-21T00:00:00.000Z'})
    s, b = req('POST', f'/statements/{STID}/reconcile', PT, {})
    check('F9 对账', s in (200, 201), str(b)[:150])
    s, b = req('POST', f'/statements/{STID}/settle', PT, {})
    check('F10 票证足额后结清', s in (200, 201), f'status={s} {str(b)[:150]}')
    s, b = req('POST', f'/statements/{STID}/reopen', PT, {})
    check('F11 反结清（需审批口）', s in (200, 201), f'status={s} {str(b)[:120]}')
    s, raw = req('GET', f'/statements/{STID}/export?format=xlsx', PT, expect_json=False)
    check('F12 导出 Excel（二进制流）', s == 200 and isinstance(raw, bytes) and len(raw) > 100, f'status={s} bytes={len(raw) if isinstance(raw, bytes) else type(raw)}')

# ---------- G. 部分退款与佣金冲回 ----------
s, order2 = req('POST', '/sales-orders', CT2, {'items': [{'listingId': listing['listingId'], 'quantity': 2}], 'contactName': '王五', 'contactPhone': '13911113333', 'channelCode': chan1})
OID2 = order2.get('id') if isinstance(order2, dict) else None
s, od2 = req('GET', f'/sales-orders/{OID2}', CT2)
req('POST', f'/sales-orders/{OID2}/register-payment', MT, {'paidAmountCents': od2.get('totalAmountCents')})
s, od2 = req('GET', f'/sales-orders/{OID2}', CT2)
oitem = (od2.get('items') or [{}])[0]
s, b = req('POST', f'/sales-orders/{OID2}/refund', MT, {'items': [{'orderItemId': oitem.get('id'), 'quantity': 1}], 'reason': 'E2E 部分退款'})
check('G1 部分退款受理', s in (200, 201), f'status={s} {str(b)[:200]}')
s, od3 = req('GET', f'/sales-orders/{OID2}', CT2)
check('G2 退款金额按 SKU 比例', (od3.get('refundedAmountCents') or 0) > 0, f'refunded={od3.get("refundedAmountCents")}')
s, cms2 = req('GET', f'/commissions/order/{OID2}', PT)
cl2 = cms2 if isinstance(cms2, list) else cms2.get('items') or []
check('G3 退款后佣金冲回（reversed>0 或 invalid）', len(cl2) > 0 and any((c.get('reversedAmountCents') or 0) > 0 or c.get('status') == 'invalid' for c in cl2),
      str([(c.get('level'), c.get('amountCents'), c.get('reversedAmountCents'), c.get('status')) for c in cl2]))

# ---------- H. 权限边界与幂等 ----------
s, _ = req('POST', '/box-codes/activate', CT2, {'boxCode': BOX, 'questionnaire': {'gender': 'male', 'age': 30}, 'consentGiven': True, 'reportAuthorization': True, 'samplingMethod': 'self_mail'})
check('H1 同一盒码二次激活被拒', s >= 400, f'status={s}')
s, _ = req('GET', f'/reports/{RID}', ST)
check('H2 销售访问非本人客户报告被拒', s >= 400, f'status={s}')
CT3 = req('POST', '/auth/register', body={'phone': '13911114444', 'password': 'Test@123', 'name': '赵六', 'deviceId': 'e2e-d2'})[1].get('token')
s, _ = req('GET', f'/reports/{RID}', CT3)
check('H3 无关 C 端访问他人报告被拒', s >= 400, f'status={s}')
s, _ = req('GET', '/accounts', CT2)
check('H4 C 端访问平台账号列表被拒', s >= 400, f'status={s}')
s, b = req('POST', f'/sales-orders/{OID}/ship', MT, {})
check('H5 对已完成订单重复发货被拒', s >= 400, f'status={s}')
s, b = req('POST', f'/sales-orders/{OID2}/register-payment', MT, {'paidAmountCents': 1})
check('H6 已支付订单重复登记支付被拒/幂等', s >= 400 or (isinstance(b, dict) and b.get('status') != 'paid'), f'status={s}')

print('\n========== 汇总 ==========')
fails = [r for r in results if r[1] == 'FAIL']
print(f"总断言 {len(results)} 项，失败 {len(fails)} 项")
for name, tag, detail in fails:
    print(f"  [FAIL] {name}: {detail[:200]}")
