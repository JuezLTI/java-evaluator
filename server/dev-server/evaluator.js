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
            programmingFeatures: {
                compilationProgram: 'javac',
                extFile: 'java',
                executionProgram: 'java',
                executionProgramParameters: ['-Duser.language=es', '-Duser.region=ES'],
                needsClassName: true
            }
        }, {
            id: "Javascript-evaluator",
            features: [{
                    name: "language",
                    value: "javascript",
                },
                {
                    name: "version",
                    value: "node v16.13.2",
                },
                {
                    name: "engine",
                    value: "https://nodejs.org/dist/v16.13.2/",
                },
            ],
            programmingFeatures: {
                compilationProgram: null,
                extFile: 'js',
                executionProgram: 'node',
                executionProgramParameters: [],
                needsClassName: false
            }
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
            programmingFeatures: {
                compilationProgram: null,
                extFile: 'py',
                executionProgram: 'python3',
                executionProgramParameters: [],
                needsClassName: false
            }
        },{
            id: "php-evaluator",
            features: [{
                    name: "language",
                    value: "php",
                },
                {
                    name: "version",
                    value: "php 7.4",
                },
                {
                    name: "engine",
                    value: "https://php.net/",
                },
            ],
            programmingFeatures: {
                compilationProgram: null,
                extFile: 'php',
                executionProgram: 'php',
                executionProgramParameters: [],
                needsClassName: false
            }
        }]

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
            let program = evalReq.request.program,
                capability = getCapability(evalReq.request.language),
                language = evalReq.request.language
            response.report = {}
            response.report.capability = capability
            response.report.programmingLanguage = language
            response.report.exercise = programmingExercise.id
            let tests = []
            try {
                programmingExercise.keywords = sanitizeKeywords(programmingExercise.keywords)
                if(!fulfilPreConditions(program, programmingExercise.keywords)) throw (
                    new Error("Your solution doesn't meet the requirements.")
                )
                var className = 'sourcecode'
                if(capability.programmingFeatures.needsClassName) {
                    className = getClassNameFromCode(program)
                    if(!className) throw (
                        new Error("Class name doesn't find. Have you defined the main class as public?")
                    )
                }
                var fileAnswer = await createFileFromCode(program, className, capability.programmingFeatures.extFile)

                if(capability.programmingFeatures.compilationProgram != null) {
                    await compileCode(fileAnswer, capability.programmingFeatures.compilationProgram)
                }

                for (let metadata of programmingExercise.tests) {
                    let lastTestError = {}
                    let input = programmingExercise.tests_contents_in[metadata.id]
                    let expectedOutput = programmingExercise.tests_contents_out[metadata.id]
                    let resultStudent = await getOutputFromCode(fileAnswer, className, input, capability)
                        .catch(error => {
                            lastTestError = error
                        })
                        expectedOutput = sanitizeOutputs(expectedOutput)
                        resultStudent = resultStudent ? sanitizeOutputs(resultStudent) : sanitizeOutputs(lastTestError.toString())
                    if(getGrade(expectedOutput, resultStudent) == 0) {
                        summary = {
                            "classify" : 'Wrong Answer',
                            "feedback" : 'Try it again'
                        }
                    }
                    tests.push(addTest(input, expectedOutput, resultStudent, lastTestError, metadata))
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
                if(fileAnswer) {cleanTmpDir(fileAnswer)}
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

const sanitizeKeywords = (keywords) => {
    let sanitizedKeywords = [];
    keywords.forEach(keyword => {
        if (keyword.includes(',')) {
            keyword.split(',').map(k => k.trim()).forEach(k => sanitizedKeywords.push(k));
        } else {
            sanitizedKeywords.push(keyword.trim());
        }
    });
    return sanitizedKeywords;
}

const fulfilPreConditions = (program, keywords) => {
    let fulfilled = true
    let programLowerCase = program.toLowerCase()

    let mandatoryKeyword = keywords.find(keyword => keyword.toLowerCase().startsWith('mandatory'));
    if (mandatoryKeyword) {
        let mandatoryKeywords = mandatoryKeyword.toLowerCase().match(/\[(.*?)\]/)[1].split(';')
        mandatoryKeywords = mandatoryKeywords.map(keyword => keyword.match(/"(.*?)"/)[1]);
        mandatoryKeywords.forEach(keyword => {
            if(!programLowerCase.includes(keyword)) {
                fulfilled = false
            }
        })
    }
    let forbiddenKeyword = keywords.find(keyword => keyword.toLowerCase().startsWith('forbidden'));
    if (forbiddenKeyword) {
        let forbiddenKeywords = forbiddenKeyword.toLowerCase().match(/\[(.*?)\]/)[1].split(';')
        forbiddenKeywords = forbiddenKeywords.map(keyword => keyword.match(/"(.*?)"/)[1]);
        forbiddenKeywords.forEach(keyword => {
            if(programLowerCase.includes(keyword)) {
                fulfilled = false
            }
        })
    }
    return fulfilled
}

const getOutputFromCode = (fileAnswer, className, input, capability) => {
    return new Promise((resolve, reject) => {
        var util = require('util'),
            path = require('path'),
            execFile = require('child_process').execFile,
            output = ''
        let dirPath = path.dirname(fileAnswer),
            executionProgramParameters = []
        if(capability.programmingFeatures.needsClassName) {
            executionProgramParameters.push(className)
        } else {
            executionProgramParameters.push(fileAnswer)
        }
        const child = execFile(capability.programmingFeatures.executionProgram,
            capability.programmingFeatures.executionProgramParameters.concat(executionProgramParameters),
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


const createFileFromCode = (code, className, extFile) => {
    return new Promise((resolve, reject) => {
        var temp = require('temp'),
            fs = require('fs'),
            path = require('path')

        // Automatically track and cleanup files at exit
        temp.track();

        temp.mkdir('compiled', function (err, dirPath) {
            var inputPath = path.join(dirPath, className + '.' + extFile)
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

const compileCode = (fileName, compilationProgram) => {
    return new Promise((resolve, reject) => {
        const { exec } = require("child_process");

        exec(compilationProgram + " " + fileName, (error, stdout, stderr) => {
            if (error) reject(error);
            if (stderr) reject(stderr)
            resolve(stdout)
        })
    })
}

const addTest = (input, expectedOutput, obtainedOutput, lastTestError, metadata) => {
    const Diff = require('diff')
    obtainedOutput = obtainedOutput ? obtainedOutput : ''
    const outputDifferences = JSON.stringify(Diff.diffTrimmedLines(expectedOutput, obtainedOutput));
    return {
        'input': input,
        'expectedOutput': visibilizeWhiteChars(expectedOutput),
        'obtainedOutput': visibilizeWhiteChars(obtainedOutput),
        'outputDifferences': outputDifferences ? outputDifferences : '',
        'classify': getClassify(expectedOutput, obtainedOutput, lastTestError),
        'mark': getGrade(expectedOutput, obtainedOutput),
        'visible': metadata.visible,
        'hint': metadata.feedback,
        'feedback': getFeedback(expectedOutput, obtainedOutput, lastTestError),
        'environmentValues': []
    }
}

const getGrade = (expectedOutput, obtainedOutput) => {
    return expectedOutput == obtainedOutput ? 100 : 0
}

const getFeedback = (expectedOutput, obtainedOutput, lastTestError) => {
    let feedback = 'Right Answer.'
    // TODO get feedback from exercise's test
    if(lastTestError) {
        feedback = lastTestError.toString()
    } else if(getGrade(expectedOutput, obtainedOutput) < 1) {
        feedback = 'Wrong Answer.'
    }
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

const sanitizeOutputs = (originalOutput) => {
 return originalOutput.replace(/(?:\r\n|\r|\n)/g, "\n")
}

const visibilizeWhiteChars = (originalString) => {
    const whiteChars = [
        {'in': '\n', 'out': '\u204B\n'},
        {'in': '\t', 'out': '\u2192\t'},
        {'in': ' ', 'out': '\u2591'},
    ]
    let replacedString = originalString;
    whiteChars.forEach(replaceObj => {
        let inRegExp = new RegExp(replaceObj.in, 'g')
        replacedString = replacedString.replace(inRegExp, replaceObj.out)
    })
    return replacedString;
}

const cleanTmpDir = (fileAnswer) => {
    const fs = require('fs'),
        path = require('path')

    // directory path
    const dir = path.dirname(fileAnswer)
    
    // delete directory recursively
    try {
      fs.rmSync(dir, { recursive: true })
    
      console.log(`${dir} is deleted!`)
    } catch (err) {
      console.error(`Error while deleting ${dir}.`)
    }
}

module.exports = {
    evalProgramming,
    capabilities
}
