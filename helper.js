export const parseNumbers = str => {
    return str.match(/(-?\d\.\d+D[+\-]\d{2})|(^\d+)|((?<= )\d+(?= ))|((?<= )-?\d+\.\d+)/g).map(num => {
        return parseFloat(num.replace(/d/i, 'e'));
    });
};

export const parseDate = (numbers, shortYear = true) => {
    const seconds = Math.floor(numbers[5]);
    return new Date(Date.UTC(
        (shortYear ? (numbers[0] > 90 ? 1900 : 2000) : 0) + numbers[0],
        numbers[1] - 1,
        numbers[2],
        numbers[3],
        numbers[4],
        seconds,
        (numbers[5] - seconds) * 1000
    ));
};
