var Task = require('../models/task');
var User = require('../models/user');

module.exports = function (router) {
    var taskRouter = router.route('/tasks');
    var ret = {
    	"message":"Success",
    	"data":{}
    }

    // POST
    taskRouter.post(async (req, res) => {
        // here it should be put in body not param
        var params = {
            'name':req.body.name,
            "description":req.body.description,
            "deadline":req.body.deadline,
            "completed":req.body.completed,
            "assignedUser":req.body.assignedUser,
            "assignedUserName":req.body.assignedUserName,
            // "dateCreated" will be generated automatically
        }

        //validation
        if (typeof params.name === 'undefined'){
            ret.message = "ERROR";
            ret.data = "Task name not found";
            res.json(404, ret);
            return router;
        }

        if (typeof params.deadline === 'undefined'){
            ret.message = "ERROR";
            ret.data = "Task deadline not found";
            res.json(404, ret);
            return router;
        }

        //update assignedUserName if assignedUser
        console.log(params);
        var assigned_user = await User.findById(params.assignedUser).then(async user=>  {
            if(user == null){
                params.assignedUser = "";
                params.assignedUserName = "unassigned"
            } else {
                params.assignedUserName = user.name;
                console.log(params);
                //push new task to user pending task
            }
        }).catch(err=>{console.log(err);});

        // handle new task
        console.log(params);
        var new_task = await new Task(params);
        new_task.save().then(async new_task => {
            if (new_task.assignedUser!="" && !new_task.completed){
                // don't add completed task to the user
                var user = await User.findByIdAndUpdate(params.assignedUser, {$push:{"pendingTasks":new_task._id}}).catch(err=>{console.log(err);});
            }
            return new_task;
        }).then((new_task)=>{
            res.status(201).send({
                "message":"Great! Task created",
                "data":new_task
            });
        });
    });

    // GET
    taskRouter.get((req, res) => {
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

        var promise = new Promise( (resolve, reject) => {
            Task.find(filter, (err, tasks) => {
                if (err){
                    reject(err);
                }else{
                    resolve(tasks);
                }
            }).sort(sort).select(select).skip(skip).limit(limit);
        });

        promise.then( tasks => {
            ret.data = tasks;
            if (count){
                ret.data = tasks.length;
            }
            res.status(200).json(ret);

        }).catch( err => {
            console.log("error;" + err);
            ret.message = "ERROR";
            ret.data = "Server Error";
            res.status(500).json(ret);
        })
	});

    return router;
}
