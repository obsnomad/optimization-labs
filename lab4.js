const readline = require('readline');
const {createReadStream, createWriteStream} = require('fs');
const Fraction = require('fraction.js');
const cTable = require('console.table');

const rl = readline.createInterface({
    input: createReadStream('lab4.txt'),
});
const stream = createWriteStream('lab4out.txt');

let data = {
    outbound: [],
    inbound: [],
    prices: [],
    table: [],
    excludedRows: [],
    excludedCols: [],
};
let nw = false; // Использовать метод северо-западного угла
let curCycle = [];

const clone = obj => {
    return JSON.parse(JSON.stringify(obj));
};

const getTable = () => {
    let result = [];
    for (let row in data.prices) {
        let item = {
            'a \\ b': data.outbound[row],
        };
        for (let col in data.prices[row]) {
            item[('' + data.inbound[col]).padStart(5, ' ')] = `[${('' + data.prices[row][col]).padStart(2, ' ')}] ${data.table[row][col] !== null ? data.table[row][col] : ''}`;
        }
        result.push(item);
    }
    return cTable.getTable(
        result,
    );
};

// Нахождение координат ячейки
const findNextPrice = () => {
    let smallest = null;
    let result = null;
    for (let row in data.prices) {
        row = parseInt(row);
        for (let col in data.prices[row]) {
            col = parseInt(col);
            if (!isExcluded(row, col)) {
                // Если метод северо-западного угла, просто вернуть координаты
                if (nw) {
                    return {row, col};
                }
                // Если метод наименьшей стоимости, то проверить на минимум
                if (smallest === null || smallest > data.prices[row][col]) {
                    smallest = data.prices[row][col];
                    result = {row, col};
                }
            }
        }
    }
    return result;
};

// Исключена ли уже строка
const isExcluded = (row, col) => {
    return data.excludedRows.indexOf(row) >= 0 || data.excludedCols.indexOf(col) >= 0;
};

// Рекурсивная функция для поиска следующего звена в цикле
const findCycleElement = (row, col, isRow = true, initRow = null, initCol = null) => {
    if (initRow == null) {
        initRow = row;
    }
    if (initCol == null) {
        initCol = col;
    }
    for (let i = 0; i < (isRow ? data.table[row].length : data.table.length); i++) {
        const curRow = isRow ? row : i;
        const curCol = isRow ? i : col;
        if ((curRow !== row || curCol !== col)
            && (data.table[curRow][curCol] !== null || initRow === curRow && initCol === curCol)) {
            if (data.table[curRow][curCol] === null
                || findCycleElement(curRow, curCol, !isRow, initRow, initCol)) {
                curCycle.push({
                    row: curRow,
                    col: curCol,
                });
                return true;
            }
        }
    }
    return false;
};

// Сумма стоимостей для цикла пересчета
const calculateGammaForCycle = cycle => {
    let result = 0;
    for (let i in cycle) {
        const val = (i % 2 === 0 ? 1 : -1) * data.prices[cycle[i].row][cycle[i].col];
        result += val;
        stream.write(`${i > 0 ? (val >= 0 ? ' + ' : ' - ') : ''}${Math.abs(val)}`);
    }
    return result;
};

// Подсчет сумм по распределительному методу
const calculateGammaDistributed = () => {
    let cycles = [];
    let minValue, minIndex;
    let index = 0;
    for (let row in data.table) {
        row = parseInt(row);
        for (let col in data.table[row]) {
            col = parseInt(col);
            if (data.table[row][col] === null) {
                curCycle = [];
                findCycleElement(row, col);
                stream.write(`γ${row + 1}${col + 1} = `);
                const sum = calculateGammaForCycle(curCycle);
                stream.write(` = ${sum}\n`);
                if (minValue === undefined || minValue > sum) {
                    minValue = sum;
                    minIndex = index;
                }
                cycles.push(curCycle);
                index++;
            }
        }
    }
    if (minValue < 0) {
        return cycles[minIndex];
    }
    return null;
};

// Подсчет сумм по методу потенциалов
const calculateGammaPotential = () => {
    let system = [];
    let potentials = {};
    for (let row in data.table) {
        row = parseInt(row);
        for (let col in data.table[row]) {
            col = parseInt(col);
            if (data.table[row][col] !== null) {
                let u = `u${row + 1}`;
                let v = `v${col + 1}`;
                if (potentials[u] === undefined) {
                    potentials[u] = Object.keys(potentials).length === 0 ? 0 : null;
                }
                if (potentials[v] === undefined) {
                    potentials[v] = Object.keys(potentials).length === 0 ? 0 : null;
                }
                system.push({
                    row,
                    col,
                    result: data.prices[row][col],
                });
                stream.write(`${u} + ${v} = ${data.prices[row][col]}\n`);
            }
        }
    }
    let emptyPotential;
    while ((emptyPotential = findEmptyPotential(potentials)) && emptyPotential.length > 0) {
        for (let item of system) {
            let u = `u${item.row + 1}`;
            let v = `v${item.col + 1}`;
            // Исключающее ИЛИ для расчета нерасчитанных потенциалов
            if (!!((potentials[u] === null) ^ (potentials[v] === null))) {
                if (potentials[u] === null) {
                    potentials[u] = item.result - potentials[v];
                }
                else {
                    potentials[v] = item.result - potentials[u];
                }
            }
        }
    }
    let keys = Object.keys(potentials);
    keys.sort();
    for (let key of keys) {
        stream.write(`${key} = ${potentials[key]}\n`);
    }

    let minValue, minRow, minCol;
    for (let row in data.table) {
        row = parseInt(row);
        for (let col in data.table[row]) {
            col = parseInt(col);
            if (data.table[row][col] === null) {
                const rowIndex = row + 1;
                const colIndex = col + 1;
                const sum = data.prices[row][col] - (potentials[`u${rowIndex}`] + potentials[`v${colIndex}`]);
                stream.write(`γ${rowIndex}${colIndex} = ${data.prices[row][col]} - (${potentials[`u${rowIndex}`]} + ${potentials[`v${colIndex}`] >= 0 ? potentials[`v${colIndex}`] : `(${potentials[`v${colIndex}`]})`}) = ${sum}\n`);
                if (minValue === undefined || minValue > sum) {
                    minValue = sum;
                    minRow = row;
                    minCol = col;
                }
            }
        }
    }
    if (minValue < 0) {
        curCycle = [];
        findCycleElement(minRow, minCol);
        return curCycle;
    }

    return null;
};

// Поиск незаполненных значений в системе потенциалов
const findEmptyPotential = potentials => {
    let result = [];
    for (let key in potentials) {
        if (potentials[key] === null) {
            result.push(key);
        }
    }
    return result;
};

// Сдвиг по циклу пересчета
const shiftByCycle = cycle => {
    let minValue, minIndex;
    // Поиск минимального отрицательного значения
    for (let i in cycle) {
        if (i % 2 === 1) {
            const value = data.table[cycle[i].row][cycle[i].col];
            if (value !== null) {
                if (minValue === undefined || minValue > value) {
                    minValue = value;
                    minIndex = i;
                }
            }
        }
    }
    // Сдвиг
    for (let i in cycle) {
        data.table[cycle[i].row][cycle[i].col] =
            i === minIndex
                ? null
                : data.table[cycle[i].row][cycle[i].col] + (i % 2 === 0 ? 1 : -1) * minValue;
    }
};

// Расчёт общей стоимости
const calculateAndOutputPrice = () => {
    let output = 'z = ';
    let result = 0;
    let index = 0;
    for (let row in data.prices) {
        for (let col in data.prices[row]) {
            if (data.table[row][col] !== null) {
                result += data.prices[row][col] * (data.table[row][col]);
                output += `${index > 0 ? ' + ' : ''}${data.prices[row][col]} × ${data.table[row][col]}`;
                index++;
            }
        }
    }
    return `${output} = ${result} ед. ст.`;
};

rl
    .on('line', line => {
        let type = null;
        const lineData = line.split(/\s+/).map(value => {
            if (isNaN(value)) {
                type = value;
                return null;
            }
            return parseInt(value);
        }).filter(value => value !== null);
        switch (type) {
            case 'A':
                data.outbound = lineData;
                break;
            case 'B':
                data.inbound = lineData;
                break;
            default:
                data.prices.push(lineData);
                data.table.push(Array(lineData.length).fill(null));
        }
    })
    .on('close', () => {
        // Поиск первого опорного решения
        let smallestPrice;
        let outbound = clone(data.outbound);
        let inbound = clone(data.inbound);
        while ((smallestPrice = findNextPrice()) !== null) {
            const {row, col} = smallestPrice;
            if (outbound[row] > inbound[col]) {
                data.table[row][col] = inbound[col];
                outbound[row] -= inbound[col];
                inbound[col] -= inbound[col];
                data.excludedCols.push(col);
            } else {
                data.table[row][col] = outbound[row];
                inbound[col] -= outbound[row];
                outbound[row] -= outbound[row];
                data.excludedRows.push(row);
            }
        }
        const table = clone(data.table); // Сохранение таблицы для использования в методе потенциалов
        let cycle;
        stream.write('Распределительный метод\n\n');
        stream.write(getTable());
        stream.write(calculateAndOutputPrice() + '\n\n');
        while ((cycle = calculateGammaDistributed()) !== null) {
            stream.write('\n');
            shiftByCycle(cycle);
            stream.write(getTable());
            stream.write(calculateAndOutputPrice() + '\n\n');
        }
        stream.write('\nМетод потенциалов\n\n');
        data.table = clone(table);
        stream.write(getTable());
        stream.write(calculateAndOutputPrice() + '\n\n');
        while ((cycle = calculateGammaPotential()) !== null) {
            stream.write('\n');
            shiftByCycle(cycle);
            stream.write(getTable());
            stream.write(calculateAndOutputPrice() + '\n\n');
        }
    });
