import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type AIAction =
  | 'explain'
  | 'fix'
  | 'optimize'
  | 'refactor'
  | 'generate_tests'
  | 'add_comments'
  | 'find_bug';

const ACTION_PROMPTS: Record<AIAction, string> = {
  explain: 'Explain the following code in detail with clear, step-by-step reasoning:',
  fix: 'Find and fix bugs in the following code. Return the corrected code and explain what was wrong:',
  optimize: 'Optimize the following code for better performance, readability, and best practices. Return the improved code with a brief explanation:',
  refactor: 'Refactor the following code to improve readability, maintainability, and structure without changing behavior. Return the refactored code and summarize key improvements:',
  generate_tests: 'Generate comprehensive unit tests for the following code. Cover normal cases, edge cases, and error cases:',
  add_comments: 'Add clear, professional comments to the following code. Preserve the original code and annotate it thoroughly:',
  find_bug: 'Analyze the following code for potential bugs, logic errors, and edge cases. List each issue with an explanation and suggested fix:',
};

function buildSystemPrompt(language: string, code: string, context: string) {
  return `You are CodeSync AI, an expert coding assistant embedded in a collaborative code editor. 
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
    const { message, code, language, context, action } = body;

    if (!message && !action) {
      return NextResponse.json(
        { error: 'Message or action is required' },
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

    let userPrompt = message;
    const validAction = action && typeof action === 'string' && action in ACTION_PROMPTS ? action as AIAction : null;
    if (validAction) {
      const selectedCode = body.selectedCode || code || '';
      userPrompt = `${ACTION_PROMPTS[validAction]}\n\n\`\`\`${language || 'javascript'}\n${selectedCode}\n\`\`\``;
    }

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
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 2000,
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

    return NextResponse.json({ response: aiResponse, provider: 'gemini', action: validAction });
  } catch (error: any) {
    console.error('AI assistant error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get AI response.' },
      { status: 500 }
    );
  }
}
