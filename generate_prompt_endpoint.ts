  app.post("/api/vibe/generate-prompt", express.json(), async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) return res.status(400).json({ error: "Missing description" });

      const systemInstruction = `Bạn là một chuyên gia viết Prompt (Prompt Engineer). 
Nhiệm vụ của bạn là viết một đoạn hướng dẫn ngắn gọn (system prompt snippet) để chèn vào ngữ cảnh của AI, nhằm định hướng AI trả lời theo một phong cách hoặc yêu cầu cụ thể mà người dùng muốn tạo nhãn.

Ví dụ: 
- Người dùng nhập: "Giải thích kiểu GenZ"
- Bạn viết: "Hãy giải thích bằng ngôn ngữ của GenZ, sử dụng các từ lóng (slang) phổ biến như 'khum', 'trầm cảm', 'slay', 'flex', nhưng vẫn đảm bảo giữ được ý nghĩa học thuật cốt lõi. Phong cách hài hước, châm biếm nhẹ nhàng."

Hãy trả về TRỰC TIẾP đoạn prompt đó, không giải thích, không bọc trong markdown block. Giữ nó ngắn gọn, mạnh mẽ và tập trung vào phong cách/yêu cầu cốt lõi.`;

      const contents = [{ role: "user", parts: [{ text: `Mô tả nhãn/phong cách: ${description}` }] }];
      const responseText = await executeGenerateContentRoundRobin(contents, {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 300,
        model: "gemini-3.6-flash" // or pro if we want
      });

      res.json({ success: true, prompt: responseText.trim() });
    } catch (err: any) {
      console.error("Failed to generate prompt:", err);
      res.status(500).json({ error: err.message });
    }
  });
