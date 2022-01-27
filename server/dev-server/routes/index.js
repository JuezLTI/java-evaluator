import express from "express";
import { loadSchemaYAPEXIL, ProgrammingExercise } from "programming-exercise-juezlti";
import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti";


import evaluator from "../evaluator";
import path from "path";
import request from "request";

import fs from "fs";

var data = [];
const email = "info@juezlti.eu";
const password = "Ju3zLT1.";
var router = express.Router();

router.get("/capabilities", function(req, res, next) {
    let evalRes = new EvaluationReport();

    let obj = {
        capabilities: [{
            id: "Java-evaluator",
            features: [{
                    name: "language",
                    value: "java",
                },
                {
                    name: "version",
                    value: ".01",
                },
                {
                    name: "engine",
                    value: "https://openjdk.java.net/",
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
        let evalReq = new EvaluationReport();
        if (evalReq.setRequest(req.body)) {
            if ("program" in evalReq.request) {
                try {
                    let exerciseObj = new ProgrammingExercise();
                    if (data.includes(evalReq.request.learningObject)) {
                        ProgrammingExercise.deserialize(path.join(__dirname, "../../public/zip"), `${evalReq.request.learningObject}.zip`).
                        then((programmingExercise) => {
                            evaluator.evalJava(programmingExercise, evalReq).then((obj) => {
                                req.java_eval_result = JSON.stringify(obj);
                                next();
                            });
                        }).catch((error) => {
                            console.log("error " + error);
                            res.statusCode(500).send("The learning object request is already in cache but was not possible to read")
                        })



                    } else {
                        loadSchemaYAPEXIL().then(() => {
                            ProgrammingExercise
                                .loadRemoteExerciseAuthorkit(evalReq.request.learningObject, email, password)
                                .then((programmingExercise) => {

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
                                    evaluator.evalJava(programmingExercise, evalReq).then((obj) => {

                                        req.java_eval_result = JSON.stringify(obj);
                                        next();
                                    });




                                }).catch((error) => {
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
        }

    })
});
const FEEDBACK_MANAGER_URL = 'http://localhost:3003';

router.post("/eval", function(req, res, next) {
    request({
            method: "POST",
            url: FEEDBACK_MANAGER_URL,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: req.java_eval_result,
        },
        function(error, response) {
            if (error) res.json(req.java_eval_result);
            else res.json(response.body);
        }
    );
});

export { router, data };
