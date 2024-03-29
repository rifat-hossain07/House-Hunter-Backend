const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB:-
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gsplul7.mongodb.net/?retryWrites=true&w=majority`;
// console.log(process.env.ACCESS_TOKEN_SECRET);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// middlewares to validate token
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // if no token
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access token" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const Collection = client.db("HouseDB");
    const userCollection = Collection.collection("Users");
    const roomCollection = Collection.collection("Rooms");
    const bookedCollection = Collection.collection("Booked");

    // set cookie with jwt
    app.post("/jwt", async (req, res) => {
      const Users = req.body;
      const email = Users.email;
      const password = Users.password;
      const filter = { email: email };
      const result = await userCollection.findOne(filter);
      if (!result) {
        res.send("User Not Exist !");
        return;
      } else if (password !== result.password) {
        res.send("Password is not Correct!");
        return;
      } else {
        const user = { email: Users.email };
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.send({ token });
        return;
      }
    });
    // user create and store in database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const filter = { email: email };
      const resul = await userCollection.findOne(filter);
      if (resul) {
        res.send("User Already Exist !");
      } else {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    });
    // get one user to show on navbar
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.findOne(filter);
      res.send(result);
    });
    // Load All Rooms with pagination
    app.get("/rooms", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await roomCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    // Room counts
    app.get("/roomsCount", async (req, res) => {
      const count = await roomCollection.estimatedDocumentCount();
      res.send({ count });
    });
    // book room
    app.put("/book/:id", async (req, res) => {
      const id = req.params.id;
      const bookedRoom = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "booked",
        },
      };
      const result = await roomCollection.updateOne(filter, updateDoc);
      const result2 = await bookedCollection.insertOne(bookedRoom);
      res.send(result);
    });
    // show booked room
    app.get("/booked", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await bookedCollection.find(filter).toArray();
      res.send(result);
    });
    // Delete Booked Room
    app.put("/roomDelete", async (req, res) => {
      const id = req.body._id;
      const name = req.body.room;
      const filter = { _id: new ObjectId(id) };
      const query = { name: name };
      const updateDoc = {
        $set: {
          status: "available",
        },
      };
      const result = await bookedCollection.deleteOne(filter);
      const result1 = await roomCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // Add room to database
    app.post("/roomsAdd", async (req, res) => {
      const room = req.body;
      const result = await roomCollection.insertOne(room);
      res.send(result);
    });
    // Room to show owned
    app.get("/ownRoom", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await roomCollection.find(filter).toArray();
      res.send(result);
    });
    // Edit the Rooms
    app.put("/updateRoom", async (req, res) => {
      const id = req.body.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: req.body.name,
          phoneNumber: req.body.phoneNumber,
          photo: req.body.photo,
          description: req.body.description,
          availabilityDate: req.body.availabilityDate,
          address: req.body.address,
          rentPerMonth: req.body.rentPerMonth,
          city: req.body.city,
          bathrooms: req.body.bathrooms,
          bedrooms: req.body.bedrooms,
          roomSize: req.body.roomSize,
          email: req.body.email,
        },
      };
      const result = roomCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Delete Room from Database
    app.put("/ownDelete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await roomCollection.deleteOne(filter);
      res.send(result);
    });
    // Search functionality
    app.get("/search", async (req, res) => {
      const { city, bedrooms, bathrooms, roomSize, availability, rentRange } =
        req.query;
      const query = {};
      if (city) query.city = city;
      if (bedrooms) query.bedrooms = bedrooms;
      if (bathrooms) query.bathrooms = bathrooms;
      if (roomSize) query.roomSize = roomSize;
      if (availability) query.availability = availability;
      if (rentRange) {
        const [minRent, maxRent] = rentRange.split("-");
        query.rentPerMonth = { $gte: minRent, $lte: maxRent };
      }
      const result = await roomCollection.find(query).toArray();
      res.send(result);
    });
    // api to input any missing field on database
    app.get("/roomsadd", async (req, res) => {
      const filter = {};
      const updateDoc = {
        $set: {
          email: "rifat@gmail.com",
        },
      };
      const result = roomCollection.updateMany(filter, updateDoc);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("House-Hunter is running");
});

app.listen(port, () => {
  console.log(`House-Hunter is running on ${port}`);
});
