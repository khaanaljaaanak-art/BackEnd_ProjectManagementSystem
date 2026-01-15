import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config({ path: path.resolve("../.env") });

const usersToSeed = [
  {
    name: "Admin One",
    email: "admin@test.com",
    role: "admin",
    password: "123456",
  },
  {
    name: "Supervisor One",
    email: "sup1@test.com",
    role: "supervisor",
    password: "123456",
  },
  {
    name: "Student One",
    email: "stu1@test.com",
    role: "student",
    password: "123456",
  },
];

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Check your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    let created = 0;
    let updated = 0;

    for (const u of usersToSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10);

      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        await User.create({
          name: u.name,
          email: u.email,
          role: u.role,
          password: hashedPassword,
        });
        created += 1;
      } else {
        existing.name = u.name;
        existing.role = u.role;
        existing.password = hashedPassword;
        await existing.save();
        updated += 1;
      }
    }

    const total = await User.countDocuments();
    console.log(
      `Seed complete. created=${created} updated=${updated} totalUsers=${total}`
    );

    const check = await User.find(
      { email: { $in: usersToSeed.map((x) => x.email) } },
      { email: 1, role: 1, name: 1 }
    ).lean();

    console.log("Seeded users:");
    for (const u of check) {
      console.log(`- ${u.email} (${u.role}) ${u.name}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

run();
