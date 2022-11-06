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
                ret.data = "Server Bugs"
                res.json(404, ret);
                return router;
            }
        })
        return router;
	});

	// PUT
	taskRoute.put(async (req, res) => {
        //  handle query
        var id = req.params.id;
        var params = {
            'name':req.query.name,
            "description":req.query.description,
            "deadline":req.query.deadline,
            "completed":req.query.completed,
            "assignedUser":req.query.assignedUser,
            "assignedUserName":req.query.assignedUserName,
            "dateCreated":req.query.dateCreated,
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
                    "data":"Task Not Found(Invalid Task Id)"
                });
                return router;
            } else {
                var old_user_id = task.assignedUser;

                if (old_assigned_user !== ""){
                    var old_assigned_user = await User.findByIdAndUpdate(old_user_id.toString(), {$pull:{"pendingTasks":task._id}},(err, user)=>{
                        if (err) {console.log(err);}
                        else{
                            console.log("old user tasks handled");
                            return user;
                        }
                    }).catch(err=>{console.log(err);});
                }
                else{var old_assigned_user = null}


                // update new assigned user

                if (typeof req.query.assignedUser === "undefined"){
                    console.log("undefined new assignedUser, do nothing");
                }else{
                    var new_assigned_user = await User.findByIdAndUpdate(params.assignedUser.toString(), {$addToSet:{"pendingTasks":task._id}}, (err, user)=>{
                        if(err){console.log(err);}
                        else{
                            console.log("new user tasks handled");
                            return user;
                        }
                    });
                }

                // update task
                if(new_assigned_user == null){
                    console.log("new assigned user invalid");
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
                        ret.data = "update failed because of server side error";
                        res.json(500, ret);
                        return router;
                    }
                    else{
                        ret.data = "Task updated";
                        ret.message = "OK";
                        res.status(200).json(ret);

                    }
                });

            }
        }).catch(error=>{
            console.log(error);
            ret.message = "ERROR";
            ret.data = "Task Not Found(Invalid Task Id)";
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
                ret.data = "Task Id not found";
                res.json(404, ret);
            } else {
                console.log("task delete from task_list");
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
                        // console.log(new_tasks);
                        User.findOneAndUpdate({"_id":task.assignedUser}, {$set:{pendingTasks: new_tasks}}).then(()=>{
                            ret.message = "OK";
                            ret.data = "Task deleted";
                            res.json(200, ret);
                        }).catch( err => {
                            console.log(err);
                            ret.message = "ERROR";
                            ret.data = "Server Error on updating User";
                            res.json(500, ret);
                        });
                    }
                }).catch(err => {
                    console.log(err);
                    ret.message = "ERROR";
                    ret.data = "Server Error on finding User";
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
