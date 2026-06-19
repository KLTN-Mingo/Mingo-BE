import mongoose from "mongoose";
import { SlangEntryModel } from "../src/models/culture-translation.model";

async function main() {
  await mongoose.connect(
    "mongodb+srv://huynh04137:Huynh9404@cluster0.ssvoieo.mongodb.net/?appName=Cluster0"
  );

  const terms = await SlangEntryModel.find({
    term: { $in: ["nhiệm vụ hệ thống ngày càng khó", "cổ điển, tôn trọng"] },
  }).lean();

  console.log("Tìm thấy:", terms.length, "terms");
  console.log(JSON.stringify(terms, null, 2));

  await mongoose.disconnect();
}
main();
