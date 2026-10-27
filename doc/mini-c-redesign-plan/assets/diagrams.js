// Mermaid 初始化（流程图 / 状态机）
(function () {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: { htmlLabels: true, curve: 'basis' },
      themeVariables: {
        primaryColor: '#eaf2ff',
        primaryBorderColor: '#1677ff',
        primaryTextColor: '#1f2329',
        lineColor: '#646a73',
        fontSize: '14px'
      }
    })
  }
})()
