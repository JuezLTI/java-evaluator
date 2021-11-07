const ProgrammingExercise = require('../programming-exercise/programming-exercise')
const EvaluationReport = require('../evaluation-report/evaluation-report')

const path = require('path');
const request = require('request');

(async() => {
    //  let exerciseObj = await ProgrammingExercise.deserialize('./programming-exercise/serialized', 'fd286cb3-5c95-4b0e-b843-56bc058a7713.zip')
    let eval = new EvaluationReport();

    console.log(eval.setRequest({
        "date": (new Date()).toISOString(),
        "program": "/bookstore/book/price//text()",
        "learningObject": "6c882692-0583-4f96-969a-b601ea0a89be"
    }))


    request({
        'method': 'POST',
        'url': 'http://localhost:3000/eval',
        'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eval.request)

    }, function(error, response) {
        if (error) throw new Error(error);
        console.log(response.body);
    });


    /*
        request({
            'method': 'GET',
            'url': 'http://localhost:3000/capabilities',
            'headers': {
                'Accept': 'application/json',
            },
        }, function(error, response) {
            if (error) throw new Error(error);
            console.log(response.body);
        });
    */
})();