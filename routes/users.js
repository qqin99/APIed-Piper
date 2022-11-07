var User = require("../models/user");
var Task = require("../models/task");

module.exports = function (router) {
    var userRoute = router.route("/users");
    var ret = {
    	"message":"OK",
    	"data":{}
    }

    // POST
    userRoute.post(async (req, res) => {
        var params = {
            "name":req.body.name,
            "email":req.body.email,
            "pendingTasks":req.body.pendingTasks
            // Here we should use body not param, cos post should be post in body. "dateCreated" is automatically generated.
        }

        // validation: Users cannot be created (or updated) without a name or email.
        if (typeof params.name === "undefined"){
            ret.message = "ERROR";
            ret.data = "Undefined user name";
            // 404: Bad Request
            res.json(404, ret);
            return router;
        }

        if (typeof params.email === "undefined"){
            ret.message = "ERROR";
            ret.data = "Undefined user email";
            res.status(404).send(ret);
            return router;
        }

        if (typeof params.pendingTasks === "undefined"){
            params.pendingTasks = []
        } else {
            params.pendingTasks = JSON.parse(params.pendingTasks);
        }

        // Multiple users with the same email cannot exist.
        await User.findOne({email:params["email"]}).then(async user=>{
            if(user){
                res.status(404).send({
                    "message":"ERROR",
                    "data":"invalid user: duplicate email in database"
                });
                return router;
            } else {  // no existing user
                // pendingTasks
                var new_tasks = params.pendingTasks;

                await Promise.all(new_tasks.map(async task_id => {
                    var task = await Task.findById(task_id).catch(err => {
                        console.log(err);
                    });
                    return task;
                })).then(async tasks => {
                    console.log(tasks);
                    var new_tasks_list = [];
                    tasks.forEach(async task=>{
                        if (task != null){
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
                    // save new user in database
                    var new_user = new User(params);
                    await new_user.save().then(async new_user=>{
                        await Task.updateMany({"_id":
                        {$in:new_user.pendingTasks}},
                        {$set:{"assignedUser": new_user._id, "assignedUserName":new_user.name}}).catch(err=>{console.log(err);});
                        return new_user;
                    }).then(new_user=>{
                        res.status(201).send({
                            "message":"OK",
                            "data":new_user
                        });
                        return router;
                    });
                });
            }
        });
    });


    // GET
    userRoute.get((req, res) => {
        //  handle query
        var filter = {};
        if("where" in req.query){
            var filter = JSON.parse(req.query.where);
        }

        var sort = {};
        if("sort" in req.query){
            var sort = JSON.parse(req.query.sort);
        }

        var select = {};
        if("select" in req.query){
            var select = JSON.parse(req.query.select);
        }

        var skip = 0;
        if("skip" in req.query){
            var skip = JSON.parse(req.query.skip);
        }

        var limit = 0;
        if("limit" in req.query){
            var limit = JSON.parse(req.query.limit);
        }

        var count = false;
        if("count" in req.query){
            var count = JSON.parse(req.query.count);
        }

        // get filtered users
        var promise = new Promise( (resolve, reject) => {
            User.find(filter, (err, users) => {
                if (err) {
                    reject(err);
                }else{
                    resolve(users);
                }
            }).sort(sort).select(select).skip(skip).limit(limit);
        });

        promise.then( (users) => {
            ret.data = users;  // can be null here
            if (count) {
                ret.data = users.length;
            }
            ret.message = "OK";
            res.status(200).json(ret);
            return router;
        }).catch( (err) => {
            console.log(err);
            ret.message = "ERROR";
            ret.data = "Server Error";
            res.json(500, ret);
            return router;
        })
	});


    return router;
}
