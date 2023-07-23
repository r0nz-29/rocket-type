const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { config } = require("dotenv");
const mongoose = require("mongoose");
const { join_lobby } = require("./lobbies.js");
const { disconnect } = require("process");
config();
const TIME=50;
const Lobbies = {"easy":[],"medium":[],"hard":[]};
const Socket_list=new Map();
const Running = new Map();
const Private_lobbies=new Map();
const app = express();
const structure = {
  socket_id: "",
  position: "",
  speed: "",
};

// lobbie={
// 	lobbie_id:"",
// 	participants:[structure..]
// }
app.use(cors());

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res
    .status(200)
    .send(
      '<img src="https://res.cloudinary.com/daa4wqa2h/image/upload/v1689840737/afj_jhrf75.png" alt="pogger" />'
    );
});
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});
// Function to transfer lobbies to running mode
// Goes through all lobies in particular difficulty decreases time 
// one with time 0 is picked A map is created which with key player_socket.id and values as player stats
// This map acts as a value for Running map which has lobbie id as key
// emits start to lobby( broadcast ) so all players can start the game

function dis(socket_id){
  let a=Socket_list.get(socket_id);
    if(Running.get(a)){
      Running.get(a).delete(socket_id);
    }
  if(a){
  io.sockets.in(a).emit('leave',socket_id);
  }
}


function transfer_lobbies(difficulty){
let a=[];
let l=Lobbies[difficulty];

for (let i = 0; i < l.length; i++) {
  l[i].time--;
  
  if (l[i].time === 0) {
    const mp = new Map();   
   
    // console.log(l[i].participants.length);
    for (let x = 0; x < l[i].participants.length; x++) {   
      // Socket_list.set(l[i].participants[x],l[i].lobbie_id);
      mp.set(l[i].participants[x], { speed: 0, pos: 0, over: false,accuracy:0,errors:0 });
    }
  Running.set(l[i].lobbie_id, mp);
  io.sockets.in(l[i].lobbie_id).emit('start');
  } else {
    a.push(l[i]);
  }
}
return a;
}
// Deletes Running lobbies with 0 players
setInterval(function (){
  // console.log(Running);
	for (const [key, value] of Running) {
    
    if(value.size==0){
      Running.delete(key);
    }
  }
},1000)
// Transfer lobbies which ran out of time to running
setInterval(function () { 
  let a=transfer_lobbies('hard');
  Lobbies.hard=a;
  a=[]
  a=transfer_lobbies('medium');
  Lobbies.medium=a;
  a=[]
  a=transfer_lobbies('easy');
  Lobbies.easy=a;
  a=[]
}, 1000);

mongoose
  .connect(process.env.DB, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(() => {
    http.listen(process.env.PORT || 3000, () => {
      console.log("Backend running at port: " + process.env.PORT);
    });
  })
  .catch((err) => {
    console.log(err);
  });

io.on("connection", function (socket) {
  console.log(socket.id);
  socket.on("join", function (difficulty) {
    console.log('diff --- ' + difficulty);
    if(difficulty.length<10){
    const room_id = join_lobby(Lobbies, difficulty, socket);
    socket.join(room_id);
    Socket_list.set(socket.id,room_id);
    let x=0;
    for(let i=0;i<Lobbies[difficulty].length;i++){
      if(Lobbies[difficulty].lobbie_id===room_id){
        x=i;
      }
    }
    console.log('lobby' + Lobbies[difficulty][x]);
    io.sockets.in(room_id).emit("new_member",Lobbies[difficulty][x]);
    }
    else{

    }
  });
  socket.on("disconnect",function(r){
    console.log(socket.id);
    dis(socket.id);
  })
function calculate_wpm(pos,accuracy,errors){
  const minutes = TIME/ 60;
	const wordsTyped = pos / 5;
	const wrongWordsTyped = errors / 5;
	const wpm = (wordsTyped - wrongWordsTyped) / minutes;
	return wpm > 0 ? wpm : 0;
}
  socket.on("new_wpm",function (data){
    const room_id=Socket_list.get(socket.id);
    Running.get(room_id).set(socket.id,data);
    const a=[]
    console.log(Running.get(room_id));
    const res = {};
    let len=0;
    for(let [key, value] of Running.get(room_id)){
      res[key] = value;
      if(res[key].over===true){
        res[key].speed=calculate_wpm(res[key].pos,res[key].accuracy,res[key].errors);
        len++;
      }
    }
    console.log(len + " ---- "+ Running.get(room_id).size)
    if(len===Running.get(room_id).size){
      io.sockets.in(room_id).emit("over",res);
      console.log("udaaa")
    }
    else{
    console.log(res);
    io.sockets.in(room_id).emit("update", res);
    }
  })
  // socket.on("leave")
});