const { OpenAI } = require('openai');
const { prisma, retryQuery } = require('../lib/prisma');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function requestOpenAI(sysPrompt, userPrompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // or 'gpt-4o-mini' depending on system setup
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });
    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI Error:', error);
    throw new Error('Failed to generate response from AI');
  }
}

class MockInterviewService {
  async startInterview(candidateId, topic) {
    const interview = await prisma.globalAiInterview.create({
      data: {
        candidateId: candidateId || null,
        topic,
      },
    });

    const sysPrompt = `You are a highly experienced interviewer.
You conduct realistic interviews.
You stay strictly within the given topic: ${topic}.
You ask one question at a time.
Generate the FIRST question. Must be easy level.
Return JSON strictly: { "question": "..." }`;

    const result = await requestOpenAI(sysPrompt, `Start the interview about ${topic}.`);
    
    await prisma.globalAiInterviewMessage.create({
      data: {
        interviewId: interview.id,
        role: 'ai',
        text: result.question,
      },
    });

    return { interviewId: interview.id, question: result.question };
  }

  async nextQuestion(interviewId, answerText) {
    // Save candidate answer
    await prisma.globalAiInterviewMessage.create({
      data: {
        interviewId,
        role: 'candidate',
        text: answerText,
      },
    });

    const messages = await prisma.globalAiInterviewMessage.findMany({
      where: { interviewId },
      orderBy: { timestamp: 'asc' },
    });

    const interview = await prisma.globalAiInterview.findUnique({ where: { id: interviewId } });

    // Evaluate the answer
    const prevAiMessage = [...messages].reverse().find(m => m.role === 'ai');
    
    if (prevAiMessage) {
        const evalPrompt = `Evaluate the candidate's answer for the following question.
Question: ${prevAiMessage.text}
Candidate's Answer: ${answerText}
Topic: ${interview.topic}

Evaluate based on Technical Accuracy, Topic Relevance, Clarity, and Depth.
Return JSON strictly:
{
"score": number (0-10),
"accuracy": number (0-10),
"clarity": number (0-10),
"feedback": "..."
}`;
        try {
            const evalResult = await requestOpenAI(evalPrompt, "Evaluate now.");
            // Update the candidate's message with score
            const candMsgId = messages[messages.length - 1].id;
            await prisma.globalAiInterviewMessage.update({
                where: { id: candMsgId },
                data: { score: evalResult.score },
            });
        } catch(e) {
            console.error("Evaluation failed, ignoring...", e);
        }
    }


    const candidateMessagesCount = messages.filter(m => m.role === 'candidate').length;
    
    if (candidateMessagesCount >= 5) { // Maximum 5 questions
        return { isFinished: true };
    }

    // Generate next question
    const historyContext = messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const sysPromptNext = `You are a highly experienced interviewer.
You adapt based on candidate performance.
You stay strictly within the given topic: ${interview.topic}.
You ask one question at a time.
You never repeat questions.
Here is the chat history:
${historyContext}

Based on the candidate's latest answer, adjust the difficulty (weaker answer -> easier, stronger -> harder).
Ask the next logical question.
Return JSON strictly: { "question": "..." }`;

    const result = await requestOpenAI(sysPromptNext, `Generate next question.`);
    
    await prisma.globalAiInterviewMessage.create({
      data: {
        interviewId,
        role: 'ai',
        text: result.question,
      },
    });

    return { isFinished: false, question: result.question };
  }

  async getResult(interviewId) {
    const messages = await prisma.globalAiInterviewMessage.findMany({
      where: { interviewId },
      orderBy: { timestamp: 'asc' },
    });

    const interview = await prisma.globalAiInterview.findUnique({ where: { id: interviewId } });
    const historyContext = messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

    const evalPrompt = `You are an expert interviewer. Review the interview history and evaluate the candidate strictly.
Topic: ${interview.topic}
History:
${historyContext}

Return JSON strictly:
{
"overallScore": number (0-100),
"skillLevel": "Beginner | Intermediate | Advanced",
"strengths": ["...", "..."],
"weaknesses": ["...", "..."],
"improvementPlan": "...",
"recommendedTopics": ["...", "..."]
}`;

    const reportData = await requestOpenAI(evalPrompt, 'Generate final report');
    
    await prisma.globalAiInterview.update({
        where: { id: interviewId },
        data: { report: reportData }
    });

    return reportData;
  }
}

module.exports = new MockInterviewService();
