import mongoose from "mongoose";
import { SlangEntryModel } from "../models/culture-translation.model";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI!);

  const terms = await SlangEntryModel.find({
    term: { $in: ["nhiệm vụ hệ thống ngày càng khó", "cổ điển, tôn trọng"] },
  }).lean();

  console.log("Tìm thấy:", terms.length, "terms");
  console.log(JSON.stringify(terms, null, 2));

  const testContent = "nhiệm vụ hệ thống ngày càng khó hơn, cổ điển, tôn trọng";
  for (const t of terms as any[]) {
    try {
      const regex = new RegExp(t.regexPattern, "gi");
      const matches = [...testContent.matchAll(regex)];
      console.log(`\nTerm: ${t.term}`);
      console.log(`Regex: ${t.regexPattern}`);
      console.log(`isActive: ${t.isActive}`);
      console.log(
        `Matches: ${matches.length > 0 ? "✅ MATCH" : "❌ KHÔNG MATCH"}`
      );
    } catch (e) {
      console.log(`❌ REGEX LỖI: ${e}`);
    }
  }

  await mongoose.disconnect();
}

main();
