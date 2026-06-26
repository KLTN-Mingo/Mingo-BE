import { ModerationService } from "../services/moderation/moderation.service";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
async function run() {
  const testCases = [
    // Sạch
    "Hôm nay trời đẹp quá, đi dạo thôi!",
    // Hate speech rõ ràng → rule block
    "Mày là đồ chó, cặc",
    // Spam quảng cáo → cần AI phát hiện
    "con di lon nay, bien",
    // Toxic tinh vi, không có từ regex → cần AI
    // "Tụi người miền Trung toàn lừa đảo, không nên tin",
    // Ngưỡng xám: chửi nhẹ nhưng không hate speech rõ ràng
    // "Ôi trời ơi sao ngu vậy, làm cái gì cũng hỏng",
  ];

  for (const text of testCases) {
    console.log("\n=== Testing:", text, "===");
    const result = await ModerationService.moderateContent(text, {
      reportCount: 1,
    });
    console.log(JSON.stringify(result, null, 2));
  }
}

run();
