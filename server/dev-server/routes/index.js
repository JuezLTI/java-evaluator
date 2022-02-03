import express from "express";
import { loadSchemaYAPEXIL, ProgrammingExercise } from "programming-exercise-juezlti";
import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti";
import dotenv from 'dotenv'
dotenv.config('../env.js');
import evaluator from "../evaluator";
import path from "path";
import request from "request";

import fs from "fs";

var data = [];

var router = express.Router();

router.get("/capabilities", function(req, res, next) {
    let evalRes = new EvaluationReport();
    let obj = {
        capabilities: [{
            id: "XPath-evaluator",
            features: [{
                    name: "language",
                    value: "XPath",
                },
                {
                    name: "version",
                    value: ".01",
                },
                {
                    name: "engine",
                    value: "https://www.npmjs.com/package/xpath",
                },
            ],
        }, ],
    };

    evalRes.setReply(obj);
    res.send(evalRes);
});

router.get("/", function(req, res) {
    let text = fs.readFileSync(
        path.join(__dirname, "../../public/doc/intro.txt"), { encoding: "utf8", flag: "r" }
    );
    let curl_exm = fs.readFileSync(
        path.join(__dirname, "../../public/doc/curl"), { encoding: "utf8", flag: "r" }
    );

    try {
        res.render("index");
    } catch (e) {
        console.log(e);
    }
});

router.post("/eval", function(req, res, next) {

    loadSchemaPEARL().then(() => {
        console.log(req.body)

        let evalReq = new EvaluationReport();
        if (evalReq.setRequest(req.body)) {
            if ("program" in evalReq.request) {
                try {
                    let exerciseObj = new ProgrammingExercise();
                    if (data.includes(evalReq.request.learningObject)) {
                        ProgrammingExercise.deserialize(path.join(__dirname, "../../public/zip"), `${evalReq.request.learningObject}.zip`).
                        then((programmingExercise) => {
                            evaluate(programmingExercise, evalReq, req, res, next)
                        }).catch((error) => {
                            console.log("error " + error);
                            res.statusCode(500).send("The learning object request is already in cache but was not possible to read")
                        })
                    } else {
                        loadSchemaYAPEXIL().then(() => {
                            ProgrammingExercise
                                .loadRemoteExercise(evalReq.request.learningObject,{
                                    'BASE_URL':process.env.BASE_URL,
                                    'EMAIL':process.env.EMAIL,
                                    'PASSWORD':process.env.PASSWORD,
                                })
                                .then((programmingExercise) => {

                                    evaluate(programmingExercise, evalReq, req, res, next)

                                    data.push(programmingExercise.id);
                                    programmingExercise
                                        .serialize(path.join(__dirname, "../../public/zip"))
                                        .then((test) => {
                                            if (test) {
                                                console.log(
                                                    `The exercise ${programmingExercise.id} was insert in cache`
                                                );
                                            }
                                        });




                                }).catch((error) => {
                                    console.log(error)
                                    console.log(" 1º error LearningObj not found or could not be loaded");
                                    res.send({ error: "LearningObj not found" });
                                });


                        })
                    }
                } catch (error) {
                    console.log(" 2º " + error);
                    res.send({ error: error });
                }
            }
        } else {
            res.send({ "error": "INVALID PEARL" }).status(500);
        }

    })
});

function evaluate(programmingExercise, evalReq, req, res, next) {
    evaluator.XPATH(programmingExercise, evalReq).then((obj) => {
        console.log("Resposta ->" + JSON.stringify(obj))
        req.xpath_eval_result = JSON.stringify(obj);
        req.number_of_tests = programmingExercise.getTests().length
            if (obj.reply.report.compilationErrors.length > 0) {
                res.send("Incorrect Answer\n").status(200);
            } else {
                res.send("Correct Answer\n").status(200);

            }
            
      //  next();
    });
}
const FEEDBACK_MANAGER_URL = 'http://localhost:3003';

router.post("/eval", function(req, res, next) {

    request({
            method: "POST",
            url: FEEDBACK_MANAGER_URL,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ PEARL: req.xpath_eval_result, additional: { numberOfTests: req.number_of_tests } })
        },
        function(error, response) {
            if (error) res.json(req.xpath_eval_result);
            else res.json(response.body);
        }
    );
});

export { router, data };