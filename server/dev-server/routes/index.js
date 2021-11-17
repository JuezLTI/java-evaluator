import express from 'express';
import { fileURLToPath } from 'url';
import EvaluationReport from '../../../evaluation-report/evaluation-report'
import ProgrammingExercise from '../../../programming-exercise/programming-exercise'
import evaluator from '../evaluator'
import path from 'path'
import fs from 'fs';

var data = []

var router = express.Router();

router.get('/capabilities', function(req, res, next) {
    let evalRes = new EvaluationReport()
    let obj = {
        "capabilities": [{
            "id": "Java-evaluator",
            "features": [{
                "name": "language",
                "value": "java"
            }, {
                "name": "version",
                "value": ".01"
            }, {
                "name": "engine",
                "value": "https://www.npmjs.com/package/xpath"
            }]
        }]

    }
    console.log(typeof obj)
    evalRes.setReply(obj)
    res.send(evalRes)

});



router.get('/', function(req, res) {
    let text = fs.readFileSync(path.join(__dirname, "../../public/doc/intro.txt"), { encoding: 'utf8', flag: 'r' });
    let curl_exm = fs.readFileSync(path.join(__dirname, "../../public/doc/curl"), { encoding: 'utf8', flag: 'r' });

    try {
        res.render('index')

    } catch (e) {
        console.log(e)
    }
})





router.post('/eval', function(req, res, next) {
    let evalReq = new EvaluationReport()
    if (evalReq.setRequest(req.body)) {
        if ('program' in evalReq.request) {
            try {
                let exerciseObj = new ProgrammingExercise()


                exerciseObj.loadRemoteExerciseAuthorkit(evalReq.request.learningObject).then(programmingExercise => {
                    try {
                        if (!data.includes(programmingExercise.id)) {
                            data.push(programmingExercise.id)
                            programmingExercise.serialize(path.join(__dirname, "../../public/zip")).then(test => {
                                if (test) {
                                    console.log(`The exercise ${programmingExercise.id} was insert in cache`)
                                }
                            })
                        }

                        evaluator.evalJava(programmingExercise, evalReq)
                        .then(obj => {;res.json(obj)})
                        .catch(e => {res.json(e)})
                    } catch (e) {
                        console.log(e)
                        res.send(e)
                    }
                })
            } catch (error) {
                console.log(error)
                res.send(error)

            }
        }
    }
});


export { router, data };
