const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const dogController = require("../controllers/dogController");
const authMiddleware = require("../middlewares/authMiddleware");

// Home route
router.get("/", (req, res) => {
  res.send("Welcome to the Dog Adoption API!");
});

// Authentication routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Dog routes
router.use(authMiddleware);
router.get("/dogs", dogController.listAdoptableDogs);
router.post("/dogs/register", dogController.registerDog);
router.post("/dogs/:id/adopt", dogController.adoptDog);
router.delete("/dogs/:id", dogController.removeDog);
router.get("/dogs/registered", dogController.listRegisteredDogs);
router.get("/dogs/adopted", dogController.listAdoptedDogs);

module.exports = router;
