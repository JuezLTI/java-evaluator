const ProgrammingExercise = require('../programming-exercise/programming-exercise')
const EvaluationReport = require('../evaluation-report/evaluation-report')

const path = require('path');
const request = require('request');

(async() => {
    //  let exerciseObj = await ProgrammingExercise.deserialize('./programming-exercise/serialized', 'fd286cb3-5c95-4b0e-b843-56bc058a7713.zip')
    let eval = new EvaluationReport();

    console.log(eval.setRequest({
        "date": (new Date()).toISOString(),
        "program": `package estructuras;

import java.util.Scanner;

public class Estructuras {

    /**
     * @param args the command line arguments
     */
    public static void main(String[] args) {
        int nota;
        Scanner teclado = new Scanner(System.in);

        // Lectura de los numeros por teclado
        nota = teclado.nextInt();

        if (nota >= 5) {
            System.out.println("APROBADO");
        }
        System.out.println("========");
        // Lectura de los numeros por teclado
        nota = teclado.nextInt();

        if (nota >= 5) {
            System.out.println("APROBADO");
        }
        System.out.println("========");
    }

}
`,
        "learningObject": "b8613a8e-1cb5-4eab-98a5-897fc49d3f53"
    }))

    console.log("\n" + JSON.stringify(eval.request) + "\n")
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
        });*/

})();