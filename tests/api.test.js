// tests/api.test.js
process.env.JWT_SECRET = "test-secret-key";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const User = require("../models/User");
const Dog = require("../models/Dog");
const jwt = require("jsonwebtoken");

// Import routes and middleware
const routes = require("../routes/routes");
const authMiddleware = require("../middlewares/authMiddleware");

let mongoServer;
let app;
let userToken;
let adopterToken;
let dogId;
let userId;
let adopterId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.disconnect();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());
  app.use("/api", routes);

  // Create test users
  const user = new User({ username: "testuser", password: "password123" });
  await user.save();
  userId = user._id;
  userToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });

  const adopter = new User({ username: "adopter", password: "password123" });
  await adopter.save();
  adopterId = adopter._id;
  adopterToken = jwt.sign({ id: adopter._id }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Dog.deleteMany({});
});

describe("Dog Adoption API", () => {
  describe("POST /api/register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/api/register")
        .send({ username: "newuser", password: "password123" });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe("User registered successfully");
    });
  });

  describe("POST /api/login", () => {
    it("should login a user and return a token", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it("should fail with invalid credentials", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ username: "testuser", password: "wrongpass" });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid credentials");
    });
  });

  describe("GET /api/dogs", () => {
    it("should list adoptable dogs", async () => {
      await new Dog({
        name: "Buddy",
        description: "Friendly dog",
        ownerId: new mongoose.Types.ObjectId(userId),
        status: "available",
      }).save();

      const res = await request(app)
        .get("/api/dogs")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.dogs.length).toBe(1);
      expect(res.body.total).toBe(1);
    });
  });

  describe("POST /api/dogs/register", () => {
    it("should register a new dog", async () => {
      const res = await request(app)
        .post("/api/dogs/register")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ name: "Buddy", description: "Friendly dog" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Buddy");
      expect(res.body.status).toBe("available");
      dogId = res.body._id;
    });

    it("should fail without authentication", async () => {
      const res = await request(app)
        .post("/api/dogs/register")
        .send({ name: "Buddy", description: "Friendly dog" });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/dogs/:id/adopt", () => {
    beforeEach(async () => {
      const dog = new Dog({
        name: "Max",
        description: "Playful dog",
        ownerId: new mongoose.Types.ObjectId(userId),
        status: "available",
      });
      await dog.save();
      dogId = dog._id;
    });

    it("should adopt a dog", async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/adopt`)
        .set("Authorization", `Bearer ${adopterToken}`)
        .send({ message: "Thanks for Max!" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("adopted");
    });

    it("should not allow adopting own dog", async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/adopt`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ message: "Thanks!" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Cannot adopt a dog you have already adopted"
      );
    });

    it("should fail if dog is already adopted", async () => {
      await Dog.findByIdAndUpdate(dogId, {
        status: "adopted",
        adoptedBy: new mongoose.Types.ObjectId(adopterId),
      });
      const res = await request(app)
        .post(`/api/dogs/${dogId}/adopt`)
        .set("Authorization", `Bearer ${adopterToken}`)
        .send({ message: "Thanks!" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Dog already adopted");
    });
  });

  describe("DELETE /api/dogs/:id", () => {
    beforeEach(async () => {
      const dog = new Dog({
        name: "Rex",
        description: "Loyal dog",
        ownerId: new mongoose.Types.ObjectId(userId),
        status: "available",
      });
      await dog.save();
      dogId = dog._id;
    });

    it("should remove a dog", async () => {
      const res = await request(app)
        .delete(`/api/dogs/${dogId}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Dog removed successfully");

      // Verify dog is actually deleted
      const deletedDog = await Dog.findById(dogId);
      expect(deletedDog).toBeNull();
    });

    it("should not allow removing adopted dog", async () => {
      await Dog.findByIdAndUpdate(dogId, {
        status: "adopted",
        adoptedBy: new mongoose.Types.ObjectId(adopterId),
      });
      const res = await request(app)
        .delete(`/api/dogs/${dogId}`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot remove adopted dog");
    });
  });

  describe("GET /api/dogs/registered", () => {
    it("should list registered dogs", async () => {
      await new Dog({
        name: "Buddy",
        description: "Friendly dog",
        ownerId: new mongoose.Types.ObjectId(userId),
        status: "available",
      }).save();

      const res = await request(app)
        .get("/api/dogs/registered")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.dogs.length).toBe(1);
      expect(res.body.total).toBe(1);
    });
  });

  describe("GET /api/dogs/adopted", () => {
    it("should list adopted dogs", async () => {
      await new Dog({
        name: "Max",
        description: "Playful dog",
        ownerId: new mongoose.Types.ObjectId(userId),
        adoptedBy: new mongoose.Types.ObjectId(adopterId),
        status: "adopted",
      }).save();

      const res = await request(app)
        .get("/api/dogs/adopted")
        .set("Authorization", `Bearer ${adopterToken}`);
      expect(res.status).toBe(200);
      expect(res.body.dogs.length).toBe(1);
      expect(res.body.total).toBe(1);
    });
  });
});
