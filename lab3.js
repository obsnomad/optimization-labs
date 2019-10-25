const readline = require('readline');
const {createReadStream, createWriteStream} = require('fs');
const Fraction = require('fraction.js');
const cTable = require('console.table');

const rl = readline.createInterface({
    input: createReadStream('lab3.txt'),
});
const stream = createWriteStream('lab3out.txt');

let matrix = []; // Текущая расширенная матрица (для метода искусственного базиса)
let matrix2 = []; // Текущая расширенная матрица (для метода больших штрафов)
let cols = []; // Количество колонок исходной матрицы
let targetFunc = {}; // Целевая функция (для метода искусственного базиса)
let targetFunc2 = {}; // Целевая функция (для метода больших штрафов)
let targetFuncNew = {}; // Новая целевая функция
let base = [];
let base2 = [];
let funcIndex = 'f'; // Буква функции для вывода в таблице

const clone = obj => {
    return JSON.parse(JSON.stringify(obj));
};

const fraction = a => {
    return new Fraction(a);
};
let mValue = fraction(0); // Значение M

const divideRow = (row, divider) => {
    for (let i in row.params) {
        row.params[i] = fraction(row.params[i]).div(fraction(divider));
    }
    row.equal = fraction(row.equal).div(fraction(divider));
    return row;
};

const getLabel = index => {
    index = parseInt(index);
    return index >= cols ? `y${index - cols + 1}` : `x${index + 1}`;
};

const getTable = (row, col) => {
    let data = [];
    let headers = ['б.п.', 'с.ч.'];
    for (let i in matrix[0].params) {
        i = parseInt(i);
        headers.push(`${i === col ? '↓' : ''}${getLabel(i)}`);
    }
    for (let i in matrix) {
        i = parseInt(i);
        let item = [
            `${i === row ? '←' : ''}${getLabel(base[i])}`,
            fraction(matrix[i].equal).toFraction(),
        ];
        for (let j in matrix[i].params) {
            const value = fraction(matrix[i].params[j]).toFraction();
            item.push(i === row && parseInt(j) === col ? `[${value}]` : value);
        }
        data.push(item);
    }
    let item = [
        funcIndex,
        fraction(targetFuncNew.equal).toFraction(),
    ];
    for (let j of targetFuncNew.params) {
        item.push(fraction(j).toFraction());
    }
    data.push(item);
    return cTable.getTable(
        headers,
        data,
    );
};

const resolveStep = () => {
    let col = findNegative();
    let values = [];
    let row;
    for (let i in matrix) {
        const value = matrix[i].params[col];
        values.push(fraction(value).compare(0) <= 0 ? null : fraction(matrix[i].equal).div(value));
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
    const multi = fraction(targetFuncNew.params[col]).neg(); // Множитель
    for (let j in targetFuncNew.params) {
        targetFuncNew.params[j] = fraction(targetFuncNew.params[j]).add(fraction(matrix[row].params[j]).mul(multi));
    }
    targetFuncNew.equal = fraction(targetFuncNew.equal).add(fraction(matrix[row].equal).mul(multi));
};

const findNegative = () => {
    const min = Math.min.apply(Math, targetFuncNew.params);
    if (min < 0) {
        for (let i in targetFuncNew.params) {
            if (targetFuncNew.params[i].equals(fraction(min))) {
                return parseInt(i);
            }
        }
    }
    return -1;
};

const updateTargetFunc = () => {
    for (let i in base) {
        const index = base[i];
        if (!fraction(targetFuncNew.params[index]).equals(0)) {
            const multi = fraction(targetFuncNew.params[index]).neg(); // Множитель
            for (let j in targetFuncNew.params) {
                targetFuncNew.params[j] = fraction(targetFuncNew.params[j]).add(fraction(matrix[i].params[j]).mul(multi));
            }
            targetFuncNew.equal = fraction(targetFuncNew.equal).add(fraction(matrix[i].equal).mul(multi));
        }
    }
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
                    const abs = fraction(item).abs();
                    if (mValue.compare(abs) < 0) {
                        mValue = abs;
                    }
                    return fraction(item).neg();
                }),
                equal: fraction(v),
            }
        } else {
            const [k, v] = line.split(' | ');
            matrix.push({
                params: k.split(' ').map(item => {
                    const abs = fraction(item).abs();
                    if (mValue.compare(abs) < 0) {
                        mValue = abs;
                    }
                    return fraction(item);
                }),
                equal: fraction(v),
            });
        }
    })
    .on('close', () => {
        mValue = mValue.mul(10); // Увеличиваем порядок M
        matrix2 = clone(matrix);
        targetFunc2 = clone(targetFunc);
        cols = matrix[0].params.length;
        // Добавляем переменные y и создаем строку для новой целевой функции
        targetFuncNew = {
            params: [],
            equal: fraction(0),
        };
        for (let i = 0; i < cols + matrix.length; i++) {
            if (i >= cols) {
                base.push(i);
                base2.push(i);
                targetFuncNew.params.push(fraction(1));
                targetFunc2.params.push(mValue); // Сразу дополняем целевую функцию для метода больших штрафов
            } else {
                targetFuncNew.params.push(fraction(0));
            }
        }
        for (let i in matrix) {
            for (let j in matrix) {
                matrix[i].params.push(fraction(i === j ? 1 : 0));
                matrix2[i].params.push(fraction(i === j ? 1 : 0));
            }
            for (let j in matrix[i].params) {
                targetFuncNew.params[j] = targetFuncNew.params[j].sub(matrix[i].params[j]);
            }
            targetFuncNew.equal = targetFuncNew.equal.sub(matrix[i].equal);
        }
        stream.write('Метод искусственного базиса\n\n');
        while (findNegative() >= 0) {
            resolveStep();
        }
        stream.write(getTable());
        stream.write('\n');
        // Переходим к исходной задаче
        funcIndex = 'z';
        for (let i in matrix) {
            matrix[i].params.splice(-base.length);
        }
        targetFuncNew = targetFunc;
        updateTargetFunc();
        while (findNegative() >= 0) {
            resolveStep();
        }
        stream.write(getTable());

        stream.write('\nМетод больших штрафов\n\n');
        funcIndex = 'zM';
        matrix = clone(matrix2);
        base = base2;
        targetFuncNew = clone(targetFunc2);
        updateTargetFunc();
        while (findNegative() >= 0) {
            resolveStep();
        }
        stream.write(getTable());
        stream.write('\n');
        // Переходим к исходной задаче
        funcIndex = 'z';
        for (let i in matrix) {
            matrix[i].params.splice(-base.length);
        }
        targetFuncNew.params.splice(-base.length);
        stream.write(getTable());
    });
