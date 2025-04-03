# Documentation (Kind Of)

- Yeah not really but there is stuff that I need to take care of once the project is done

## The Basics

- Essentially it is split into 3 parts
- The express server (this handles all the api routes)
- the front end (all html css js) files are stored in here
- The DB backend (interacts with the database)

The front end hits up the express server which talks to the backend, everything is done in vanilla js html css

### The DB Backend is in /backend/db

- db.js (interacts with the main DB where most of the relationships are stored)
- redis.js (This is the session store (all sessions expire within an hour))
- note you can only access these with a **.env** file so i'll be sending that in teams too otherwise nothing will work
- schema.sql This is the entire structure of the database as of now, if you're going to make changes make sure to let us know cause i only have the one

### The Express Server

- This has the authentication middleware which is called `sessionMiddleware()` in the code this keeps the cookie and is house all the auth works so if you have cookies disabled it won't work
- has all the routes with split into sections by comments

### HTML CSS

- yeah it's just html css
- assets stored in assets
- to make a page create a subfolder in `/public`and put an `index.html` file into it then when you run it it will automatically serve that page at that url.

# How to Run It?

1. Put the `.env` file into `/backend` otherwise the program won't start
2. Make sure you have node.js installed
3. go into the `/backend` folder and run `npm i` in terminal
4. now run `node app.js` and everything should run!
5. go to http://localhost:3000 and register for an account and if anything runs smoothly you should arive at the dashboard
6. Try creating a team (this works for now) if it works and a team shows up in your user interface everything works!
   **Note**: The express server currently just uses a default connection to the postgres server which times out after a while. If the server crashes after inactivity that's normal. Likely has to be fixed by using a connection pool instead

## To Do ->

A lot of things to be done

- Sign Out Mechanism
- Calling Others In a Team
- Creating Events for a Team
- more intuitive ui
- _and much much more_

## Done

- login register
- Chatting with others in a team
- Inviting Others in a team
