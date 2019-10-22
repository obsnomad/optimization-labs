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

const divideRow = (row, divider) => {
    for (let i in row.params) {
        row.params[i] = fraction(row.params[i]).div(fraction(divider));
    }
    row.equal = fraction(row.equal).div(fraction(divider));
    return row;
};

const getTable = (row, col) => {
    let data = [];
    let headers = ['б.п.', 'с.ч.'];
    for (let i in matrix[0].params) {
        i = parseInt(i);
        headers.push(`${i === col ? '↓' : ''}x${i + 1}`);
    }
    for (let i in matrix) {
        i = parseInt(i);
        let item = [
            `${i === row ? '←' : ''}x${parseInt(base[i]) + 1}`,
            matrix[i].equal.toFraction(),
        ];
        for (let j in matrix[i].params) {
            const value = matrix[i].params[j].toFraction();
            item.push(i === row && parseInt(j) === col ? `[${value}]` : value);
        }
        data.push(item);
    }
    let item = [
        'z',
        targetFunc.equal.toFraction(),
    ];
    for (let j of targetFunc.params) {
        item.push(j.toFraction());
    }
    data.push(item);
    return cTable.getTable(
        headers,
        data,
    );
};

const resolve = (row, col) => {
    matrix[row] = divideRow(matrix[row], matrix[row].params[col]);
    for (let i in matrix) {
        i = parseInt(i);
        if (i !== row) {
            const multi = fraction(matrix[i].params[col]).neg(); // Множитель
            for (let j in matrix[i].params) {
                matrix[i].params[j] = fraction(matrix[i].params[j]).add(fraction(matrix[row].params[j]).mul(multi));
            }
            matrix[i].equal = fraction(matrix[i].equal).add(fraction(matrix[row].equal).mul(multi));
        }
    }
    const multi = fraction(targetFunc.params[col]).neg(); // Множитель
    for (let j in targetFunc.params) {
        targetFunc.params[j] = fraction(targetFunc.params[j]).add(fraction(matrix[row].params[j]).mul(multi));
    }
    targetFunc.equal = fraction(targetFunc.equal).add(fraction(matrix[row].equal).mul(multi));
};

const findNegative = () => {
    const min = Math.min.apply(Math, targetFunc.params);
    if (min < 0) {
        for (let i in targetFunc.params) {
            if (targetFunc.params[i].equals(fraction(min))) {
                return parseInt(i);
            }
        }
    }
    return -1;
};

rl
    .on('line', line => {
        // Получаем расширенную матрицу из файла построчно
        if (line.substr(0, 1) === 't') {
            // С символа 't' начинается целевая функция
            let [k, v] = line.split(' | ');
            if (v === undefined) {
                v = 0;
            }
            targetFunc = {
                params: k.split(' ').filter(item => item !== 't').map(item => {
                    return fraction(item).neg();
                }),
                equal: fraction(v),
            }
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
        for (let i in targetFunc.params) {
            if (targetFunc.params[i].equals(0)) {
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
                        if (!matrix[i].params[index].equals(1)) {
                            matrix[i] = divideRow(matrix[i], matrix[i].params[index]);
                        }
                        baseNew.push(index);
                        break;
                    }
                }
            }
        }
        base = baseNew;
        while (findNegative() >= 0) {
            let col = findNegative();
            let values = [];
            let row;
            for (let i in matrix) {
                const value = matrix[i].params[col];
                values.push(value.compare(0) < 0 ? null : matrix[i].equal.div(value));
            }
            const cleanValues = values.filter(item => item !== null);
            if (cleanValues.length === 0) {
                console.error('Задача решений не имеет');
                return;
            }
            const min = Math.min.apply(Math, cleanValues);
            for (let i in values) {
                if (values[i] !== null && values[i].equals(fraction(min))) {
                    row = parseInt(i);
                    break;
                }
            }
            stream.write(getTable(row, col));
            stream.write('\n');
            base[row] = col;
            resolve(row, col);
        }
        stream.write(getTable());
    });
