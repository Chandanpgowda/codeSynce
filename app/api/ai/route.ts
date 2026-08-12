import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function buildSystemPrompt(language: string, code: string, context: string) {
  return `You are CodeSynce AI, an expert coding assistant embedded in a collaborative code editor. 
You help developers with:
- Code writing and debugging
- Code explanations
- Best practices and optimization
- Algorithm design
- Any programming questions

Current language: ${language || 'javascript'}
Current code context:
\`\`\`
${code || ''}
\`\`\`

Project context: ${context || 'No additional context'}

Be concise, helpful, and provide code examples when relevant.`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, code, language, context } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY is not configured in .env.local');
      return NextResponse.json(
        { error: 'AI assistant is not configured. Please add your GOOGLE_API_KEY to .env.local.' },
        { status: 500 }
      );
    }

    const systemPrompt = buildSystemPrompt(language, code, context);

    const response = await fetch(
      `${GOOGLE_API_BASE}/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google AI API error:', errorData);
      const errorMessage = errorData?.error?.message || `Failed to get AI response (${response.status}).`;
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    return NextResponse.json({ response: aiResponse, provider: 'gemini' });
  } catch (error: any) {
    console.error('AI assistant error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get AI response.' },
      { status: 500 }
    );
  }
}
