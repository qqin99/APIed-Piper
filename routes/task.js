var User = require('../models/user');
var Task = require('../models/task');
const { response } = require('express');

module.exports = function (router) {
    var taskRoute = router.route('/tasks/:id');
    var ret = {
    	"message":"OK",
    	"data":{}
    }
    // GET
    taskRoute.get(async (req, res) => {
        //  handle query
        var id = req.params.id
        console.log(id);

        var promise = new Promise((resolve, reject) => {
            Task.findById(id, (err, task) => {
                if (err){
                    console.log("error;" + err);
                    ret.message = "ERROR";
                    ret.data = "Invalid task ID"
                    res.json(404, ret);
                    return router;
                }else{
                    resolve(task);
                }
            });
        });

        promise.then( task => {
            console.log(task);
            if (task == null){
                throw new Error("Invalid task ID");
            } else {
                ret.data = task;
                ret.message = "OK"
                console.log(ret);
                res.json(200, ret);
                return router;
            }
        }).catch( err => {
            if (err.message == "Invalid task ID"){
                ret.message = "ERROR";
                ret.data = "Invalid task ID"
                res.json(404, ret);
                return router;
            } else {
                ret.message = "ERROR";
                ret.data = "Server Error"
                res.json(500, ret);
                return router;
            }
        })
        return router;
	});

	// PUT
	taskRoute.put(async (req, res) => {
        //  here it should be params not query as python file put data in url
        var id = req.params.id;
        var params = {
            'name':req.params.name,
            "description":req.params.description,
            "deadline":req.params.deadline,
            "completed":req.params.completed,
            "assignedUser":req.params.assignedUser,
            "assignedUserName":req.params.assignedUserName,
            "dateCreated":req.params.dateCreated,
        };
        if (typeof params.description === 'undefined') {params.description = '';}
        if (typeof params.completed === 'undefined') {params.completed = false;}
        if (typeof params.assignedUser === 'undefined') {params.assignedUser = '';}
        if (typeof params.assignedUserName === 'undefined') {params.assignedUserName = 'unassigned';}
        if (typeof params.dateCreated === 'undefined') {params.dateCreated = new Date();}
        var old_task_id;
        var newuserid = req.query.assignedUser

        //validation
        if (typeof req.query.name === 'undefined'){
            ret.message = "ERROR";
            ret.data = "Undefined task name";
            res.json(404, ret);
            return router;
        }

        if (typeof req.query.deadline === 'undefined'){
            ret.message = "ERROR";
            ret.data = "Undefined task deadline";
            res.json(404, ret);
            return router;
        }

        // update old assigned user
        await Task.findById(id).then(async task => {
            if(task == null){
                res.status(404).send({
                    "message":"ERROR",
                    "data":"Invalid Task Id, task Not Found"
                });
                return router;
            } else {
                var old_user_id = task.assignedUser;

                if (old_assigned_user !== ""){
                    var old_assigned_user = await User.findByIdAndUpdate(old_user_id.toString(), {$pull:{"pendingTasks":task._id}},(err, user)=>{
                        if (err) {console.log(err);}
                        else{
                            console.log("Previous assgined user's tasks updated");
                            return user;
                        }
                    }).catch(err=>{console.log(err);});
                }
                else{var old_assigned_user = null}


                // update new assigned user

                if (typeof req.query.assignedUser === "undefined"){
                    console.log("Undefined new assigned User, do nothing");
                }else{
                    var new_assigned_user = await User.findByIdAndUpdate(params.assignedUser.toString(), {$addToSet:{"pendingTasks":task._id}}, (err, user)=>{
                        if(err){console.log(err);}
                        else{
                            console.log("New assigned user's tasks updated");
                            return user;
                        }
                    });
                }

                // update task
                if(new_assigned_user == null){
                    console.log("New assigned user is invalid");
                    params.assignedUser = "";
                    params.assignedUserName = "unassigned";
                }
                else{
                    params.assignedUserName = new_assigned_user.name;
                }
                var updated_task = await Task.findByIdAndUpdate(id, params, (err, user)=>{
                    if(err){
                        console.log(err);
                        ret.message = "ERROR";
                        ret.data = "Update failed due to server error";
                        res.json(500, ret);
                        return router;
                    }
                    else{
                        ret.data = "Task updated.";
                        ret.message = "Success!";
                        res.status(200).json(ret);

                    }
                });

            }
        }).catch(error=>{
            console.log(error);
            ret.message = "ERROR";
            ret.data = "Task Not Found(Invalid Task Id).";
            res.json(404, ret);
            return router;
        });
	});

	// DELETE
	taskRoute.delete( (req, res) => {
        //  handle query
        var id = req.params.id;
        console.log("id: " + id);
        // remove task
        var handleTask = new Promise((resolve, reject) => {
            Task.findByIdAndRemove(id, (err, task) => {
                if (err){
                    reject(err);
                }else{
                    resolve(task);
                }
            });
        });

        // remove pendingtask in user
        handleTask.then(task => {
            console.log(task);
            if (!task) {
                ret.message = "ERROR";
                ret.data = "Task Id not found.";
                res.json(404, ret);
            } else {
                console.log("Task is deleted from task list");
                var handleUser = new Promise((resolve, reject) => {
                    User.findById(task.assignedUser, (err, user) => {
                        if (err){
                            reject(err);
                        }else{
                            resolve(user);
                        }
                    });
                });
                handleUser.then(user => {
                    // this user can be null
                    if (user) {
                        var new_tasks = user.pendingTasks.filter( value => value !== id);

                        User.findOneAndUpdate({"_id":task.assignedUser}, {$set:{pendingTasks: new_tasks}}).then(()=>{
                            ret.message = "Success";
                            ret.data = "Task is deleted";
                            res.json(200, ret);
                        }).catch( err => {
                            console.log(err);
                            ret.message = "ERROR";
                            ret.data = "Update failed due to Server Error";
                            res.json(500, ret);
                        });
                    }
                }).catch(err => {
                    console.log(err);
                    ret.message = "ERROR";
                    ret.data = "Finding user failed due to Server Error";
                    res.json(500, ret);
                });
            }
        }).catch(err => {
            console.log(err);
            ret.message = "ERROR";
            ret.data = "Task Id Not Found(Invalid Task ID)";
            res.json(404, ret);
        });
	});

    return router;
}
