import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"
import { resolve } from "path"

async function evalJava(programmingExercise, evalReq) { 
    return new Promise((resolve) => {
        loadSchemaPEARL().then(async () => {


            let evalRes = new EvaluationReport()
            evalRes.setRequest(evalReq.request)
            let program = evalReq.request.program
            let response = {}
            response.report = {}
            response.report.capability = {
                "id": "Java-evaluator",
                "features": [{
                    "name": "language",
                    "value": "Java"
                }, {
                    "name": "version",
                    "value": "openjdk 11.0.12"
                }, {
                    "name": "engine",
                    "value": "https://www.npmjs.com/package/java"
                }]
            }
            response.report.programmingLanguage = "Java"
            response.report.exercise = programmingExercise.id
            response.report.compilationErrors = []
            let tests = []
            try {
                var fileAnswer = await createFileFromCode(program)
                for (let metadata of programmingExercise.tests) {
                    let lastTestError = {}
                    let input = programmingExercise.tests_contents_in[metadata.id]
                    let expectedOutput = programmingExercise.tests_contents_out[metadata.id]
                    let resultStudent = await getOutputFromCode(fileAnswer, input)
                        .catch(error => {
                            lastTestError = error
                        })
                    tests.push(addTest(input, expectedOutput, resultStudent, lastTestError))
                }
                response.report.tests = tests
                evalRes.setReply(response)
                resolve(evalRes)

            } catch (error) {
                console.log('error: ', error)
                response.report.compilationErrors.push(error)
                evalRes.setReply(response)
                resolve(evalRes)
            }
        })
    })
}


const getOutputFromCode = (info, input) => {
    return new Promise((resolve, reject) => {
        var util = require('util'),
            execFile = require('child_process').execFile,
            output = ''
        const child = execFile('java', ['-Duser.language=es', '-Duser.region=ES', info.path],
            {
                timeout: 1000,
                maxBuffer: 65535
            }, function (err, stdout, stderr) {
                reject(err)
            })

        child.stdin.setEncoding = 'utf-8'

        child.stdout.on('data', (data) => {
            output += data.toString()
        })

        // Handle error output
        child.stderr.on('data', (data) => {
            reject(data)
        })
        child.stdout.on('end', async function (code) {
            resolve(output)
        })

        process.stdin.pipe(child.stdin)
        child.stdin.write(input + '\n')
    })
}

const createFileFromCode = (code) => {
    return new Promise((resolve, reject) => {
        var temp = require('temp'),
            fs = require('fs')

        // Automatically track and cleanup files at exit
        temp.track()

        // Process the data (note: error handling omitted)
        temp.open({ suffix: '.java' }, function (err, info) {
            if (!err) {
                fs.write(info.fd, code, (err) => {
                    if (err) reject(err)
                })
                fs.close(info.fd, function (err) {
                    if (err) reject(err)
                    resolve(info)
                })
            }
        })
    })
}

const addTest = (input, expectedOutput, obtainedOutput, lastTestError) => {
    const Diff = require('diff')
    obtainedOutput = obtainedOutput ? obtainedOutput : ''
    const outputDifferences = JSON.stringify(Diff.diffTrimmedLines(expectedOutput, obtainedOutput));
    return {
        'input': input,
        'expectedOutput': expectedOutput,
        'obtainedOutput': obtainedOutput,
        'outputDifferences': outputDifferences ? outputDifferences : '',
        'classify': getClassify(expectedOutput, obtainedOutput, lastTestError),
        'mark': getGrade(expectedOutput, obtainedOutput),
        'feedback': getFeedback(expectedOutput, obtainedOutput),
        'environmentValues': []
    }
}

const getGrade = (expectedOutput, obtainedOutput) => {
    return expectedOutput == obtainedOutput ? 100 : 0
}

const getFeedback = (expectedOutput, obtainedOutput) => {
    let feedback = 'Right Answer.'
    // TODO get feedback from exercise's test

    if(getGrade(expectedOutput, obtainedOutput) < 1)
        feedback = 'Wrong Answer.'

    return feedback
}

const getClassify = (expectedOutput, obtainedOutput, lastTestError) => {
    let classify = ''
console.log('lastTestError: ' + JSON.stringify(lastTestError))
    if(getGrade(expectedOutput, obtainedOutput) < 1)
        classify = 'Wrong Answer.'
    if(lastTestError?.code) {
        switch(lastTestError.code) {
            case 143:
                classify = 'Timeout.'
                break
            default:
                classify = 'Compilation/Runtime Error.'
        }
    }
    return classify
}

module.exports = {
    evalJava
}
