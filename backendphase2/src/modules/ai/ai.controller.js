import { sendResponse, sendError } from '../../utils/response.js';
import { env } from '../../config/env.js';

export const aiController = {
  async generateJobDescription(req, res) {
    try {
      const { jobTitle, company, jobType, jobCategory } = req.body;

      if (!jobTitle || !company) {
        return sendError(res, 400, 'Job title and company are required');
      }

      if (!env.ANTHROPIC_API_KEY) {
        return sendError(res, 500, 'Anthropic API key not configured');
      }

      // Set up streaming response (plain text stream)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const prompt = `Generate a professional job description for the role: ${jobTitle} at ${company}. ${jobType ? `Job type: ${jobType}.` : ''} ${jobCategory ? `Category: ${jobCategory}.` : ''} Include: role summary, key responsibilities (bullet list), requirements, and what we offer. Format in HTML.`;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: 'You are an expert HR copywriter. Write professional, engaging job descriptions.',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write('data: [DONE]\n\n');
                res.end();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  res.write(parsed.delta.text);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }

        res.end();
      } catch (error) {
        console.error('Anthropic API error:', error);
        res.write(`Error: ${error.message}`);
        res.end();
      }
    } catch (error) {
      sendError(res, 500, error.message, error);
    }
  },
};
