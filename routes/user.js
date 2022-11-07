var User = require('../models/user');
var Task = require('../models/task');

module.exports = function (router) {
    var userRoute = router.route('/users/:id');
    var ret = {
    	"message":"OK",
    	"data":{}
    }

    // GET
    userRoute.get(function (req, res) {
        //  handle query
        var id = req.params.id
        var promise = new Promise(function(resolve, reject){
            User.findById(id, function(err, user) {
                if (err){
                    ret.message = "ERROR";
                    ret.data = "Invalid user ID"
                    res.json(404,ret);
                    return router;
                } else {
                    resolve(user);
                }
            });
        });

        promise.then(function(user){
            ret.data = user;
            ret.message = "OK";
            res.json.status(200).send(ret);
        }).catch(function(err){
            console.log(err);
            ret.message = "ERROR";
            ret.data = "Server Error";
            res.json(500, ret);
            return router;
        })
	});

	// PUT
	userRoute.put(async function (req, res) {
        // this is user's http put query, py script put data in the url
        var id = req.params.id;
        var params = {
            "name":req.params.name,
            "email":req.params.email,
            "pendingTasks":req.params.pendingTasks,
            "dateCreated": req.params.dateCreated
        };

        var user_name;

        //validation
        if (typeof params.name === 'undefined'){
            ret.message = "ERROR";
            ret.data = "Undefined user name";
            res.json(404, ret);
            return router;
        }
        if (typeof params.email === 'undefined'){
            ret.message = "ERROR";
            ret.data = "Undefined user email";
            res.json(404, ret);
            return router;
        }
        if (typeof params.pendingTasks === 'undefined'){
            params.pendingTasks = [];
        } else {
            params.pendingTasks = JSON.parse(params.pendingTasks);
        }
        if (typeof params.dateCreated === 'undefined'){
            params.dateCreated = new Date();
        }

        // invalid user id
        await User.findById(id).then(user => {
            if(user == null){
                res.status(404).send({
                    "message":"ERROR",
                    "data":"Invalid User Id"
                });
                return router;
            }
        }).catch(error=>{
            console.log(error);
            ret.message = "ERROR";
            ret.data = "Invalid User Id";
            res.json(404, ret);
            return router;
        });

        // avoid same email with other users
        await User.findOne({email: params['email']}).then(async user => {
            if(user._id.toString()!=id){  // same email
                res.status(404).send({
                    "message":"ERROR",
                    "data":"Invalid Email"
                });
                return router;
            } else {
                // handle old pendingTasks(old user is replaced, so the task related should be unassigned)
                var old_tasks = user.pendingTasks;
                await Promise.all(old_tasks.map(async taskId=>{
                    await Task.findByIdAndUpdate(taskId,
                        {$set:{"assignedUser":'', "assignedUserName":"unassigned"}}).catch(err => {
                            console.log(err);
                        });
                })).then(async () => {
                    // handle new pendingTasks (validation)
                    var new_tasks = params.pendingTasks;
                    // console.log(new_tasks);
                    await Promise.all(new_tasks.map(async taskId=>{
                        var task = await Task.findById(taskId).catch(err=>{
                            console.log(err);
                        });
                        return task;
                    })).then(async tasks => {
                        console.log(tasks);
                        var new_tasks_list = [];
                        tasks.forEach(async task=>{
                            if (task!=null){
                                console.log(task._id);
                                if (!task.completed) {  // don't add a complete task into the new user's pendingTasks
                                    new_tasks_list.push(task._id);
                                    // update old user or report err (cuz the task hasn't assigned to user yet;)
                                    await User.findByIdAndUpdate(task.assignedUser, {$pull:{"pendingTasks":task._id}}).catch(err => {console.log(err)});
                                }
                            }
                        });
                        return new_tasks_list;
                    }).then( async new_tasks_list => {
                        params.pendingTasks = new_tasks_list;
                        console.log(params.pendingTasks);
                        await User.findByIdAndUpdate(id, params, {"new":true}).then(async user=>{
                            await Task.updateMany({"_id":
                            {$in:params.pendingTasks}},
                            {$set:{"assignedUser": id, "assignedUserName":params.name}}).catch(err=>{console.log(err);});
                            // return user;
                        }).then(()=>{
                            res.status(201).send({
                                "message":"OK",
                                "data": "finish PUT"
                            });
                        }).catch(err=>{console.log(err);});
                    });
                })
            }
        }).catch(err => {
            console.log(err);
        });
        return router;
	});

	// DELETE
	userRoute.delete( async (req, res) => {
        var id = req.params.id

        // updateMany(<filter>, <update>) // it seems that updateMany() wont't fail even when nothing needs to update
        await Task.updateMany({"assignedUser":id},
        {"assignedUser":"", "assignedUserName":"unassigned"}).catch( err => {
            console.log(err);
            ret.message = "ERROR";
            ret.data = "Server Error";
            res.json(500, ret);
        });

        // delete user
        var promise = new Promise( (resolve, reject) => {
            User.findByIdAndRemove(id, (err, user) => {
                if (err){
                    reject(err);
                }else{
                    // but user can be null
                    resolve(user);
                }
            });
        });

        promise.then( user => {
            if (user) {
                ret.message = "OK";
                ret.data = "User deleted";
                res.json(200, ret);
            } else {
                // ???
                ret.message = "ERROR";
                ret.data = "User Id Not Found";
                res.json(404, ret);
            }
        }).catch( err => {
            console.log(err);
            ret.message = "ERROR";
            ret.data = "User Id Not Found(Invalid User Id)";
            res.json(404, ret);
        });


	});
    return router;
}
