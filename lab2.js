const readline = require('readline');
const {createReadStream, createWriteStream} = require('fs');
const Iter = require('es-iter');
const Fraction = require('fraction.js');
const cTable = require('console.table');

const rl = readline.createInterface({
    input: createReadStream('lab2.txt'),
});
const stream = createWriteStream('lab2out.txt');

let matrix = []; // Текущая расширенная матрица
let arResult = {}; // Все решения
let targetFunc = []; // Целевая функция
let base = [];

const fraction = a => {
    return new Fraction(a);
};

rl
    .on('line', line => {
        // Получаем расширенную матрицу из файла построчно
        if (line.substr(0, 1) === 't') {
            // С символа 't' начинается целевая функция
            line.split(' ').map(item => {
                if (item !== 't') {
                    targetFunc.push(fraction(item));
                }
            });
        } else {
            const [k, v] = line.split(' | ');
            matrix.push({
                params: k.split(' ').map(item => {
                    return fraction(item);
                }),
                equal: fraction(v),
            });
        }
    })
    .on('close', () => {
        // Определяем базисные переменные
        for (let i in targetFunc) {
            if (targetFunc[i].equals(0)) {
                base.push(parseInt(i));
            }
        }
        // Ищем базисные переменные в уравнениях
        let baseNew = [];
        for (let i in matrix) {
            for (let index of base) {
                if (!matrix[i].params[index].equals(0)) {
                    let isBase = true;
                    for (let j in matrix) {
                        isBase = isBase && (i === j || matrix[j].params[index].equals(0));
                    }
                    if (isBase) {
                        baseNew.push(index);
                    }
                }
            }
        }
        base = baseNew;

    });
