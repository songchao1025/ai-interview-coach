// netlify/functions/ai-proxy.js
exports.handler = async (event, context) => {
    // 重要：让函数在回调后立即返回，不等待事件循环清空
    context.callbackWaitsForEmptyEventLoop = false;

    // 只允许 POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: '请求体格式错误' };
    }

    const { prompt } = body;
    const apiKey = process.env.ZHIPU_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: 'API Key 未配置' };
    }

    // 构建最精简的系统提示
    const systemPrompt = '你是一个专业面试官，只输出合法JSON，无其他内容。';

    try {
        // 添加 AbortController 超时控制（25秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'glm-4-flash',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 800   // 限制生成长度
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('AI 请求失败:', error);
        return {
            statusCode: 504,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'AI 服务响应超时，请稍后重试' })
        };
    }
};