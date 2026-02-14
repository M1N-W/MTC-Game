/**
 * 🤖 MTC: ENHANCED EDITION - AI System
 * Gemini API integration (optional)
 */

class GeminiAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    
    async generate(prompt) {
        if (!this.apiKey) return null;
        
        try {
            const response = await Promise.race([
                fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                }),
                new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000))
            ]);
            
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.warn('AI generation failed:', e);
            return null;
        }
    }
    
    async getBossTaunt(situation) {
        const prompt = `คุณคือ "ครูมานพ" ครูคณิตศาสตร์ สถานการณ์: ${situation} ตอบ: 1 ประโยคสั้นๆ ภาษาไทย (ไม่เกิน 12 คำ)`;
        const result = await this.generate(prompt);
        
        if (!result) {
            const fallbacks = [
                "ทำการบ้านมาหรือเปล่า!",
                "เกรดแย่แบบนี้จะสอบติดมั้ย?",
                "สมการนี้ง่ายนิดเดียว!",
                "มาเรียนพิเศษเสาร์-อาทิตย์ไหม?"
            ];
            return randomChoice(fallbacks);
        }
        
        return result;
    }
    
    async getReportCard(score, wave) {
        const prompt = `คุณคือ "ครูมานพ" คะแนน: ${score}, Wave: ${wave} ตอบ: ความเห็นครู 1 ประโยค`;
        return await this.generate(prompt) || "ตั้งใจเรียนให้มากกว่านี้นะ...";
    }
    
    async getMissionName() {
        const prompt = `สร้างชื่อภารกิจคณิตศาสตร์สั้นๆ ภาษาไทย (ไม่เกิน 6 คำ)`;
        return await this.generate(prompt) || "ภารกิจพิชิตสมการ";
    }
}

const Gemini = new GeminiAI("AIzaSyAZrYjazB7HHLERjKFtVazz-Mi5dfmR0v8");

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GeminiAI, Gemini };
}
