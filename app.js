const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "twitterClone.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server runs at http://localhost:3000");
    });
  } catch (e) {
    console.log(`error ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//// API-1 USER REGISTRATION

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    let jwtToken = authHeader.split(" ")[1];
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "santosh123", async (error, payLoad) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payLoad.username;
          next();
        }
      });
    }
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

app.post("/register", async (Request, Response) => {
  const userData = Request.body;
  const { username, password, name, gender } = userData;
  const checkingQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const checkData = await db.get(checkingQuery);
  if (checkData === undefined) {
    if (password.length < 6) {
      Response.status(400);
      Response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertQuery = `INSERT INTO user (name, username, password, gender) VALUES ('${name}', '${username}', '${hashedPassword}', '${gender}');`;
      await db.run(insertQuery);
      Response.send("User created successfully");
      Response.status(200);
    }
  } else {
    Response.status(400);
    Response.send("User already exists");
  }
});

/// API - 2 LOGIN

app.post("/login", async (Request, Response) => {
  const { username, password } = Request.body;
  const loginCheckQuery = `SELECT * FROM user WHERE username = '${username}';`;
  loginCheckData = await db.get(loginCheckQuery);
  if (loginCheckData === undefined) {
    Response.status(400);
    Response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      loginCheckData.password
    );
    if (!isPasswordMatch) {
      Response.status(400);
      Response.send("Invalid password");
    } else {
      const payLoad = { username: username };

      const jwtToken = jwt.sign(payLoad, "santosh123");
      console.log(jwtToken);
      Response.send({ jwtToken: jwtToken });
    }
  }
});

/// APE - 3

app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  let userId = await db.all(getUserIdQue);
  userId = userId[0].user_id;
  const getQuery = `SELECT username, tweet, date_time AS dateTime FROM user NATURAL JOIN tweet WHERE user_id IN (SELECT following_user_id from follower WHERE follower_user_id = ${userId}) ORDER BY dateTime DESC LIMIT 4;`;
  const data = await db.all(getQuery);
  response.send(data);
});

/// API - 4

app.get("/user/following", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  let dbUserId = await db.get(getUserIdQue);
  let userId = dbUserId.user_id;
  const getFollowingRequest = `SELECT name FROM user WHERE user_id IN (SELECT following_user_id FROM follower WHERE follower_user_id = ${userId});`;
  const followingData = await db.all(getFollowingRequest);
  console.log(followingData);
  response.send(followingData);
});

/// API-5

app.get("/user/followers", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  let dbUserId = await db.get(getUserIdQue);
  let userId = dbUserId.user_id;
  const getFollowersQuery = `SELECT name FROM user WHERE user_id IN (SELECT follower_user_id FROM follower WHERE following_user_id = ${userId});`;
  const followersData = await db.all(getFollowersQuery);
  console.log(followersData);
  response.send(followersData);
});

/// API - 6

app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  console.log(tweetId);
  const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  let dbUserId = await db.get(getUserIdQue);
  let userId = dbUserId.user_id;
  console.log(userId);
  const getTweetQuery = `SELECT tweet FROM tweet WHERE tweet_id = ${tweetId} AND user_id IN (SELECT follower_user_id FROM follower WHERE following_user_id = ${userId})`;
  const userData = await db.get(getTweetQuery);
  console.log(userData);
  if (userData === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const tweetQue = `SELECT tweet, COUNT (DISTINCT like_id) AS likes, COUNT (DISTINCT reply_id) AS replies, date_time AS dateTime FROM (tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id) AS T LEFT JOIN reply on t.tweet_id =reply.tweet_id WHERE tweet.tweet_id = ${tweetId}`;
    const tweet = await db.get(tweetQue);
    response.send(tweet);
  }
});

/// API - 7

app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    console.log(tweetId);
    const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
    let dbUserId = await db.get(getUserIdQue);
    let userId = dbUserId.user_id;
    console.log(userId);
    const getTweetQuery = `SELECT tweet FROM tweet WHERE tweet_id = ${tweetId} AND user_id IN (SELECT follower_user_id FROM follower WHERE following_user_id = ${userId})`;
    const userData = await db.get(getTweetQuery);
    console.log(userData);
    if (userData === undefined) {
      console.log("3");
      response.status(401);
      response.send("Invalid Request");
    } else {
      const likesQue = `SELECT user.name FROM user INNER JOIN like ON user.user_id = like.user_id WHERE like.tweet_id = '${tweetId}';`;
      const likes = await db.all(likesQue);
      response.send({ likes: likes.map((each) => each.name) });
    }
  }
);

/// API - 8

app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    console.log(tweetId);
    const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
    let dbUserId = await db.get(getUserIdQue);
    let userId = dbUserId.user_id;
    console.log(userId);
    const getRepliesQuery = `SELECT tweet FROM tweet WHERE tweet_id = ${tweetId} AND user_id IN (SELECT follower_user_id FROM follower WHERE following_user_id = ${userId});`;
    const repliesData = await db.get(getRepliesQuery);
    console.log(repliesData);
    if (repliesData === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const replyQue = `SELECT name, reply FROM (user NATURAL JOIN tweet) AS t INNER JOIN reply ON t.tweet_id = reply.tweet_id WHERE tweet.tweet_id = ${tweetId};`;
      const replies = await db.all(replyQue);
      response.send(replies);
    }
  }
);

/// API - 9

app.get("/user/tweets", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  let dbUserId = await db.get(getUserIdQue);
  let userId = dbUserId.user_id;
  console.log(userId);
  const getUserTweetsQuery = `SELECT tweet.tweet AS "tweet", COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies, tweet.date_time AS dateTime FROM (tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id) AS t LEFT JOIN reply ON t.tweet_id = reply.tweet_id where tweet.user_id = ${userId} GROUP BY tweet.tweet_id;`;
  const userTweetsData = await db.all(getUserTweetsQuery);
  console.log(userTweetsData);
  response.send(userTweetsData);
});

/// API - 10

app.post("/user/tweets", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  console.log(username);
  const getUserIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  let dbUserId = await db.get(getUserIdQue);
  let userId = dbUserId.user_id;
  const userPostQuery = `
    INSERT INTO
    tweet ( tweet, user_id)
  VALUES
    ('${tweet}', ${userId});`;
  const tweetResponse = await db.run(userPostQuery);
  const tweet_id = tweetResponse.lastID;
  response.send("Created a Tweet");
});

/// API - 11

app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const userIdQue = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userIdResponse = await db.get(userIdQue);
  const userId = userIdResponse.user_id;
  console.log(userId);
  const checkingQuery = `SELECT tweet FROM tweet WHERE tweet_id = ${tweetId} AND user_id = ${userId};`;
  const checkData = await db.get(checkingQuery);
  console.log("sa");
  console.log(checkData);

  if (checkData == undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const delQue = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
    await db.run(delQue);
    response.send("Tweet Removed");
  }
});

/// sample
app.get("/get", authenticateToken, async (request, response) => {
  const tweetId = 2;
  const getQue = `SELECT name, reply FROM (user NATURAL JOIN tweet) AS t INNER JOIN reply ON t.tweet_id = reply.tweet_id WHERE tweet.tweet_id = ${tweetId};`;
  const replyQue = `SELECT * FROM reply;`;
  const replies = await db.all(replyQue);
  const data = await db.all(getQue);
  console.log(replies);
  console.log(data);
  response.send(data);
});

module.exports = app;
