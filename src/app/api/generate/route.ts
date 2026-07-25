import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    privacyWarning: { type: Type.STRING, description: "個人名やNG表現の自動修正メッセージ（問題なければ空文字）" },
    patterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          text: { type: Type.STRING }
        },
        required: ["title", "text"]
      }
    }
  },
  required: ["patterns"]
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, subjectOrArea, episodes, endRule, customEnding, minChars, maxChars, tags, customNgWords } = body;

    let endingInstruction = "";
    switch (endRule) {
      case 'desu-masu':
        endingInstruction = "文末は「〜でした。」「〜が見られました。」などの【敬体（です・ます調）】で統一してください。";
        break;
      case 'da-deu':
        endingInstruction = "文末は「〜した。」「〜が見られた。」「〜についての理解を深めた。」などの【常体（である調・断定調）】で統一してください。";
        break;
      case 'dekiru':
        endingInstruction = "文末は「〜ができる。」「〜を理解している。」「〜に努めている。」などの観点記述形式で統一してください。";
        break;
      case 'custom':
        endingInstruction = `文末は次のルールに従って統一してください: 「${customEnding}」`;
        break;
    }

    const tagInstruction = tags && tags.length > 0
      ? `特に以下の観点・キーワードを意識して強調してください: 【${tags.join('、')}】`
      : '';

    const ngWordInstruction = customNgWords
      ? `以下の校内NGワード・回避表現が含まれていた場合は絶対に使わず、前向きな表現（リフレーミング）に置き換えてください: 【${customNgWords}】`
      : '';

    const prompt = `
あなたは教員（小学校・中学校）です。
以下のデータをもとに、通知表または指導要録に記載する適切な所見文案を【3パターン】作成してください。

【厳守事項・ルール】
1. 個人情報保護のため、特定できる児童生徒の個人名は絶対に使わず、「${studentId || '児童A'}」という表記にするか主語を自然に省略してください。
2. 過度にネガティブな表現や校内NGワードが含まれていた場合は、ポジティブな成長の可能性（リフレーミング）に変換し、privacyWarning に変化内容を簡単に記載してください。
3. 文字数は各案【${minChars || 120}文字〜${maxChars || 150}文字】の範囲に厳密に収めてください。
4. ${endingInstruction}
5. ${tagInstruction}
6. ${ngWordInstruction}

【児童生徒データ】
・対象領域: ${subjectOrArea || '学級所見・行動の記録'}

【観察メモ（エピソード）】
${episodes}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.3,
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return NextResponse.json({
        patterns: data.patterns,
        privacyWarning: data.privacyWarning || null
      });
    }

    return NextResponse.json({ error: "生成に失敗しました" }, { status: 500 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}