import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"

const capabilities = [{
            id: "Java-evaluator",
            features: [{
                    name: "language",
                    value: "java",
                },
                {
                    name: "version",
                    value: "openjdk 11.0.15",
                },
                {
                    name: "engine",
                    value: "https://openjdk.java.net/",
                },
            ],
        }, {
            id: "Python-evaluator",
            features: [{
                    name: "language",
                    value: "python",
                },
                {
                    name: "version",
                    value: "3.9.2",
                },
                {
                    name: "engine",
                    value: "https://www.python.org/download/releases/3.0/",
                },
            ],
        },]

async function evalProgramming(programmingExercise, evalReq) {
    return new Promise((resolve) => {
        loadSchemaPEARL().then(async () => {


            var evalRes = new EvaluationReport(),
                response = {},
                summary = {
                    "classify" : 'Accepted',
                    "feedback" : 'Well done'
                }

            evalRes.setRequest(evalReq.request)
            let program = evalReq.request.program
            response.report = {}
            response.report.capability = getCapability(evalReq.request.language)
            response.report.programmingLanguage = "Java"
            response.report.exercise = programmingExercise.id
            let tests = []
            try {
                var path = require('path'),
                    className = getClassNameFromCode(program)
                if(!className) throw (
                    new Error("Class name doesn't find. Have you defined the main class as public?")
                )
                var fileAnswer = await createFileFromCode(program, className)

                await compileCode(fileAnswer)
                let dirPath = path.dirname(fileAnswer)
                // let className = path.basename(fileAnswer).replace(path.extname(fileAnswer), '')
                for (let metadata of programmingExercise.tests) {
                    let lastTestError = {}
                    let input = programmingExercise.tests_contents_in[metadata.id]
                    let expectedOutput = programmingExercise.tests_contents_out[metadata.id]
                    let resultStudent = await getOutputFromCode(dirPath, className, input)
                        .catch(error => {
                            lastTestError = error
                        })
                    if(getGrade(expectedOutput, resultStudent) == 0) {
                        summary = {
                            "classify" : 'Wrong Answer',
                            "feedback" : 'Try it again'
                        }
                    }
                    tests.push(addTest(input, expectedOutput, resultStudent, lastTestError))
                }

            } catch (error) {
                summary = {
                    "classify" : "Compile Time Error",
                    "feedback" : error.message
                }
            } finally {
                response.report.tests = tests
                evalRes.setReply(response)
                evalRes.summary = summary
                resolve(evalRes)
            }
        })
    })
}

const getCapability = (language) => {
    let languagesArray = []
    capabilities.forEach(element => {
        languagesArray.push(element.features[element.features.findIndex(subelement => subelement.name == 'language')].value)
    })

    let indexCapability = languagesArray.findIndex(languageElement => languageElement.toLowerCase() == language.toLowerCase())
    return capabilities[indexCapability]
}

const getOutputFromCode = (dirPath, className, input) => {
    return new Promise((resolve, reject) => {
        var util = require('util'),
            execFile = require('child_process').execFile,
            output = ''
        const child = execFile('java', ['-Duser.language=es', '-Duser.region=ES', className],
            {
                cwd: dirPath,
                timeout: 1000,
                maxBuffer: 65535
            }, function (err, stdout, stderr) {
                if(err) reject(err)
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


const createFileFromCode = (code, className) => {
    return new Promise((resolve, reject) => {
        var temp = require('temp'),
            fs = require('fs'),
            path = require('path')

        // Automatically track and cleanup files at exit
        temp.track();

        temp.mkdir('compiled', function (err, dirPath) {
            var inputPath = path.join(dirPath, className + '.java')
            fs.writeFile(inputPath, code, function (err) {
                if (err) throw err;
                resolve(inputPath)
            })
        });
    })
}

const getClassNameFromCode = (code) => {
    let className = (code.match(/public[ \t]*class[ \t]*([^\{]*)/) || [])[1]
    return className && className.trim()
}

const compileCode = (fileName) => {
    return new Promise((resolve, reject) => {
        const { exec } = require("child_process");

        exec("javac " + fileName, (error, stdout, stderr) => {
            if (error) reject(error);
            if (stderr) reject(stderr)
            resolve(stdout)
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
    let classify = 'Accepted'

    if(getGrade(expectedOutput, obtainedOutput) < 1)
        classify = 'Wrong Answer'
    if(lastTestError?.code) {
        switch(lastTestError.code) {
            case 143:
                classify = 'Time Limit Exceeded'
                break
            default:
                classify = 'Runtime Error'
        }
    }
    return classify
}

module.exports = {
    evalProgramming,
    capabilities
}
