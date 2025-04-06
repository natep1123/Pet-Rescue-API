const Dog = require("../models/Dog");

// List all available dogs for adoption
// --> GET /dogs
exports.listAdoptableDogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { status: "available" }; // Only dogs that are available for adoption

    const dogs = await Dog.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Dog.countDocuments(query);

    res.json({
      dogs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Register a new dog for adoption
// --> POST /dogs/register
exports.registerDog = async (req, res) => {
  try {
    const { name, description } = req.body;
    const dog = new Dog({
      name,
      description,
      ownerId: req.user.id,
    });
    await dog.save();
    res.status(201).json(dog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Adopt a dog
// --> POST /dogs/:id/adopt
exports.adoptDog = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const dog = await Dog.findById(id);
    if (!dog) return res.status(404).json({ message: "Dog not found" });
    if (dog.status === "adopted")
      return res.status(400).json({ message: "Dog already adopted" });
    if (dog.ownerId.toString() === req.user.id)
      return res
        .status(400)
        .json({ message: "Cannot adopt a dog you have already adopted" });

    dog.adoptedBy = req.user.id;
    dog.adoptedMessage = message;
    dog.status = "adopted";
    await dog.save();

    res.json(dog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Remove a dog from the platform
// --> DELETE /dogs/:id
exports.removeDog = async (req, res) => {
  try {
    const { id } = req.params;
    const dog = await Dog.findById(id);
    if (!dog) return res.status(404).json({ message: "Dog not found" });
    if (dog.status === "adopted")
      return res.status(400).json({ message: "Cannot remove adopted dog" });

    if (dog.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Dog.deleteOne({ _id: id });
    res.json({ message: "Dog removed successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// List all dogs registered by the user
// --> GET /dogs/registered
exports.listRegisteredDogs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { ownerId: req.user.id };
    if (status) query.status = status;

    const dogs = await Dog.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Dog.countDocuments(query);

    res.json({
      dogs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// List all dogs adopted by the user
// --> GET /dogs/adopted
exports.listAdoptedDogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { adoptedBy: req.user.id };

    const dogs = await Dog.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Dog.countDocuments(query);

    res.json({
      dogs,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
