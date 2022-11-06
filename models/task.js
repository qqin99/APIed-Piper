var mongoose = require('mongoose')

// define user Schema
var TaskSchema = new mongoose.Schema({
  name: String,
  description:{type:String, default:"No description, user is lasy"},
  deadline: Date,
  completed:{type:Boolean, default:false},
  assignedUser: {type: String, default:""},
  assignedUserName: {type: String, default:"unassigned"},
  dateCreated:{type: Date, default:Date.now}

});

module.exports = mongoose.model('Task', TaskSchema)
