const {readFileSync, createWriteStream} = require('fs');
const Fraction = require('fraction.js');
const cTable = require('console.table');

const input = readFileSync('lab8.txt').toString().split('\n');
const stream = createWriteStream('lab8out.txt');

const fraction = a => {
    return new Fraction(a);
};

const updateMValue = val => {
    const abs = fraction(val).abs();
    if (mValue.compare(abs) < 0) {
        mValue = abs;
    }
};

let mValue = fraction(0); // Значение M

let targetFunc = {
    numerator: input[0].split(' ').map(item => {
        updateMValue(item);
        return fraction(item);
    }),
    denominator: input[1].split(' ').map(item => {
        updateMValue(item);
        return fraction(item);
    }),
};
let matrix = [];
for (let i = 2; i < input.length; i++) {
    if (input[i].length > 0) {
        const [k, v] = input[i].split(' | ');
        updateMValue(v);
        matrix.push({
            params: k.split(' ').map(item => {
                updateMValue(item);
                return fraction(item);
            }),
            equal: fraction(v),
        });
    }
}

const divideRow = (row, divider) => {
    for (let i in row.params) {
        row.params[i] = fraction(row.params[i]).div(fraction(divider));
    }
    row.equal = fraction(row.equal).div(fraction(divider));
    return row;
};

const getLabel = index => {
    index = parseInt(index);
    if (index < y0Index) {
        return `y${index + 1}`;
    }
    else if (index === y0Index) {
        return 'y0';
    }
    else if (index === uIndex) {
        return 'u';
    }
    return '';
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
        fraction(targetFunc.equal).toFraction(),
    ];
    for (let j of targetFunc.new) {
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
    const multi = fraction(targetFunc.new[col]).neg(); // Множитель
    for (let j in targetFunc.new) {
        targetFunc.new[j] = fraction(targetFunc.new[j]).add(fraction(matrix[row].params[j]).mul(multi));
    }
    targetFunc.equal = fraction(targetFunc.equal).add(fraction(matrix[row].equal).mul(multi));
};

const findNegative = () => {
    const min = Math.min.apply(Math, targetFunc.new);
    if (min < 0) {
        for (let i in targetFunc.new) {
            if (targetFunc.new[i].equals(fraction(min))) {
                return parseInt(i);
            }
        }
    }
    return -1;
};

mValue = mValue.mul(10); // Увеличиваем порядок M
mValue = fraction(200);
let cols = matrix[0].params.length; // Количество переменных в исходной системе ограничений
let colsBase = matrix.length; // Количество добавленных базисных переменных для уравнивания системы ограничений
let base = []; // Индексы базовых переменных
let y0Index = cols + colsBase; // Индекс переменной y0
let uIndex = y0Index + 1; // Индекс переменной u
for (let i = cols; i < y0Index; i++) {
    base.push(i);
}
base.push(uIndex);
for (let i in matrix) {
    for (let j in matrix) {
        matrix[i].params.push(fraction(i === j ? 1 : 0)); // Добавление базисных переменных в матрицу
    }
    matrix[i].params.push(matrix[i].equal.neg()); // Добавление переменной y0 в матрицу
    matrix[i].params.push(fraction(0)); // Добавление переменной u в матрицу
    matrix[i].equal = fraction(0);
}
// Вводим дополнительную строку в систему ограничений
const newTargetValues = (new Array(colsBase + 2)).fill(fraction(0));
matrix.push({
    params: [...targetFunc.denominator, ...newTargetValues],
    equal: fraction(1),
});
// Получаем новую целевую функцию по методу больших штрафов
targetFunc.new = [...targetFunc.numerator, ...newTargetValues];
targetFunc.equal = mValue.neg();
for (let i in targetFunc.new) {
    targetFunc.new[i] = targetFunc.new[i].neg().sub(matrix[colsBase].params[i].mul(mValue));
}
matrix[colsBase].params[uIndex] = 1;

funcIndex = 'zM';
while (findNegative() >= 0) {
    resolveStep();
}
stream.write(getTable());
stream.write('\n');

stream.write(`zmax = zM = ${targetFunc.equal.toFraction()}\n`);

// Заполнение значений переменных исходной системы ограничений
const y0BaseIndex = base.indexOf(y0Index);
if(y0BaseIndex < 0) {
    stream.write('y0 не является свободным членом\n');
    return;
}
const y0 = matrix[y0BaseIndex].equal;
let tValues = (new Array(cols)).fill(fraction(0));
for (let i = 0; i < cols; i++) {
    const index = base.indexOf(i);
    tValues[i] = index < 0 ? 0 : matrix[index].equal.div(y0).toFraction();
}
stream.write(`tmax: (${tValues.join('; ')})\n`);
