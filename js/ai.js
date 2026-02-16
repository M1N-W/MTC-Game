/**
 * 🤖 MTC: ENHANCED EDITION - AI System (REFACTORED V2)
 * Gemini API integration with improved error handling and configuration
 * 
 * ⭐ IMPROVEMENTS:
 * - Better error handling (no more console errors)
 * - Easy model configuration
 * - Graceful fallbacks
 * - Request timeout protection
 * - Fixed prompt engineering for better responses
 */

// ==================== AI CONFIGURATION ====================
const AI_CONFIG = {
    // 🎯 แก้ตรงนี้เพื่อเปลี่ยนโมเดล AI
    model: 'gemini-2.5-flash',  // โมเดลที่ใช้
    
    timeout: 5000,              // เวลารอสูงสุด (ms)
    maxRetries: 1,              // จำนวนครั้งที่ลองใหม่
    enabled: false,              // เปิด/ปิด AI (false = ใช้ fallback เท่านั้น)
    
    // API endpoint
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// ==================== GEMINI AI CLASS ====================
class GeminiAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.model = AI_CONFIG.model;
        this.enabled = AI_CONFIG.enabled && !!apiKey;
        
        if (!apiKey) {
            console.warn('⚠️ Gemini API key not found - AI features disabled');
            this.enabled = false;
        } else if (this.enabled) {
            console.log(`✅ Gemini AI initialized with model: ${this.model}`);
        }
    }
    
    /**
     * สร้าง URL สำหรับ API request
     */
    getAPIUrl() {
        return `${AI_CONFIG.baseURL}/${this.model}:generateContent?key=${this.apiKey}`;
    }
    
    /**
     * ส่ง request ไปยัง Gemini API
     * @param {string} prompt - คำสั่งที่ต้องการให้ AI ตอบ
     * @returns {Promise<string|null>} - ข้อความตอบกลับ หรือ null ถ้าเกิด error
     */
    async generate(prompt) {
        // ถ้า AI ถูกปิด ให้ return null ทันที
        if (!this.enabled) {
            return null;
        }
        
        try {
            const response = await Promise.race([
                // ส่ง request
                fetch(this.getAPIUrl(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ 
                            parts: [{ text: prompt }] 
                        }],
                        generationConfig: {
                            temperature: 0.9,
                            maxOutputTokens: 100,  // จำกัดความยาว
                        }
                    })
                }),
                // Timeout protection
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), AI_CONFIG.timeout)
                )
            ]);
            
            // ตรวจสอบ status code
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`⚠️ Model '${this.model}' not found. Please update AI_CONFIG.model`);
                } else if (response.status === 429) {
                    console.warn('⚠️ API rate limit reached');
                } else if (response.status === 400) {
                    console.warn('⚠️ Invalid API request');
                } else {
                    console.warn(`⚠️ API error: ${response.status}`);
                }
                return null;
            }
            
            const data = await response.json();
            
            // ดึงข้อความตอบกลับ
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!text) {
                console.warn('⚠️ No response from AI');
                return null;
            }
            
            return text.trim();
            
        } catch (error) {
            // จัดการ error แบบเงียบๆ ไม่ให้ console error
            if (error.message === 'timeout') {
                console.warn('⚠️ AI request timeout');
            } else if (error.message.includes('Failed to fetch')) {
                console.warn('⚠️ Network error - AI unavailable');
            } else {
                console.warn('⚠️ AI request failed:', error.message);
            }
            return null;
        }
    }
    
    /**
     * ขอคำพูดจากบอส (พร้อม fallback)
     * @param {string} situation - สถานการณ์ปัจจุบัน
     * @returns {Promise<string>} - คำพูดของบอส
     */
    async getBossTaunt(situation) {
        // Fallback messages (ใช้ถ้า AI ไม่ทำงาน)
        const fallbacks = [
            "ทำการบ้านมาหรือเปล่า!",
            "เกรดแย่แบบนี้จะสอบติดมั้ยเนี่ย?",
            "สมการนี้ง่ายนิดเดียว!",
            "อ่อนเลขขนาดนี้ มาเรียนพิเศษไหม?",
            "log 4.57 เท่าไหร่เนี่ย?",
            "คิดเลขไม่ออก สอบตกแน่!",
            "นักเรียนยุคนี้ อ่อนแอจริงๆ",
            "แค่นี้ก็ทำไม่ได้แล้วเหรอ?"
        ];
        
        // ลองใช้ AI
        if (this.enabled) {
            const prompt = `คุณคือ "ครูมานพ" ครูคณิตศาสตร์ที่เข้มงวดและชอบแซว

สถานการณ์: ${situation}

กรุณาตอบเป็นประโยคเดียวสั้นๆ ภาษาไทยแบบครูพูด (ไม่เกิน 15 คำ)
ห้ามมี emoji ห้ามใช้เครื่องหมาย * หรือ **
ตอบแค่ประโยคเดียว ไม่ต้องมีคำนำหน้า`;
            
            const result = await this.generate(prompt);
            
            if (result) {
                // ทำความสะอาดข้อความ (ลบ emoji และ markdown)
                const cleaned = result
                    .replace(/[*_~`]/g, '')  // ลบ markdown
                    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // ลบ emoji
                    .replace(/^["']|["']$/g, '')  // ลบ quotes
                    .trim();
                
                if (cleaned.length > 0 && cleaned.length < 100) {
                    return cleaned;
                }
            }
        }
        
        // ถ้า AI ไม่ทำงาน ใช้ fallback
        return this.getRandomItem(fallbacks);
    }
    
    /**
     * ขอความเห็นครูจากผลการเล่น (พร้อม fallback)
     * @param {number} score - คะแนน
     * @param {number} wave - เวฟที่ผ่าน
     * @returns {Promise<string>} - ความเห็นของครู
     */
    async getReportCard(score, wave) {
        const fallbacks = {
            excellent: [
                "เก่งมาก! แบบนี้ต้องได้เกรด A แน่นอน",
                "ยอดเยี่ยม! ครูภูมิใจมาก",
                "คะแนนเต็ม! นักเรียนดีเด่น"
            ],
            good: [
                "ดีมาก ค่อนข้างพอใช้",
                "ผ่านได้ แต่ยังต้องฝึกต่อ",
                "ไม่เลว แต่ต้องพยายามให้มากกว่านี้"
            ],
            poor: [
                "คะแนนต่ำไป ต้องตั้งใจเรียนให้มากกว่านี้",
                "ยังไม่ดีพอ กลับไปทบทวนอีกครั้ง",
                "ได้คะแนนน้อยเกินไป จะสอบผ่านได้มั้ย?"
            ]
        };
        
        // ลองใช้ AI
        if (this.enabled) {
            const prompt = `คุณคือ "ครูมานพ" ครูคณิตศาสตร์

นักเรียนทำคะแนนได้: ${score} แต้ม
ผ่าน Wave: ${wave}

ให้ความเห็นเป็นประโยคเดียวสั้นๆ ภาษาไทย (ไม่เกิน 20 คำ)
ห้ามมี emoji
ตอบแค่ประโยคเดียว`;
            
            const result = await this.generate(prompt);
            if (result) {
                const cleaned = result
                    .replace(/[*_~`]/g, '')
                    .replace(/^["']|["']$/g, '')
                    .trim();
                if (cleaned.length > 0 && cleaned.length < 150) {
                    return cleaned;
                }
            }
        }
        
        // Fallback: เลือกตามคะแนน
        let category;
        if (score > 5000) category = 'excellent';
        else if (score > 2000) category = 'good';
        else category = 'poor';
        
        return this.getRandomItem(fallbacks[category]);
    }
    
    /**
     * สร้างชื่อภารกิจ (พร้อม fallback)
     * @returns {Promise<string>} - ชื่อภารกิจ
     */
    async getMissionName() {
        const fallbacks = [
            "พิชิตครูมานพ",
            "สงครามสมการ",
            "ปฏิบัติการคณิตศาสตร์",
            "ภารกิจเลขลึกลับ",
            "ผจญภัยห้องคณิต",
            "ลุยสูตรสมการ",
            "ศึกคณิตมรณะ",
            "บททดสอบสุดโหด"
        ];
        
        // ลองใช้ AI
        if (this.enabled) {
            const prompt = `สร้างชื่อภารกิจเกี่ยวกับการต่อสู้กับครูคณิตศาสตร์
ภาษาไทย สั้นๆ 3-6 คำ
ห้ามมี emoji ห้ามมี quotes
ตอบแค่ชื่อภารกิจเท่านั้น

ตัวอย่าง: พิชิตครูมานพ, สงครามสมการ, ภารกิจคณิตมรณะ`;
            
            const result = await this.generate(prompt);
            if (result) {
                // ทำความสะอาดข้อความ
                const cleaned = result
                    .replace(/[*_~`"']/g, '')
                    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                    .split('\n')[0]  // เอาบรรทัดแรก
                    .trim();
                
                // ตรวจสอบว่าเป็นชื่อภารกิจที่ดูโอเค
                if (cleaned.length > 0 && cleaned.length < 50 && !cleaned.includes('แน่นอน')) {
                    return cleaned;
                }
            }
        }
        
        return this.getRandomItem(fallbacks);
    }
    
    /**
     * Helper: สุ่มเลือกจาก array
     */
    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    /**
     * เปลี่ยนโมเดล AI (สำหรับ advanced users)
     * @param {string} modelName - ชื่อโมเดลใหม่
     */
    setModel(modelName) {
        this.model = modelName;
        console.log(`🔄 AI model changed to: ${modelName}`);
    }
    
    /**
     * เปิด/ปิด AI
     * @param {boolean} enabled - true = เปิด, false = ปิด
     */
    setEnabled(enabled) {
        this.enabled = enabled && !!this.apiKey;
        console.log(`🔄 AI ${this.enabled ? 'enabled' : 'disabled'}`);
    }
}

// ==================== CREATE INSTANCE ====================
const Gemini = new GeminiAI(API_KEY);

// ==================== EXPORT ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GeminiAI, Gemini, AI_CONFIG };
}
