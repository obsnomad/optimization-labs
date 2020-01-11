import {cos, inv, multiply, norm, pow, sin, sqrt, transpose} from 'mathjs';
import {getCoord} from './helper';

export default {
    c: 299792458,
    CR: -4.442807633e-10,
    resSest: [],
    resX: [],
    eps: 1e-6,

    calc(nav, obs) {
        return this.getValues(nav, obs.data, obs.header);
    },

    calcCompare(nav, obs) {
        const values = this.getValues(nav, obs.data, obs.header);
        const valuesCompare = this.getValues(nav, obs.dataCompare, obs.headerCompare);
        return({
            dx: getCoord('x', values, valuesCompare),
            dy: getCoord('y', values, valuesCompare),
            dz: getCoord('z', values, valuesCompare),
        });
    },

    getValues(nav, obsData, obsHeader) {
        obsData.sat.forEach(sat => {
            const navIndex = `PG${('' + sat.num).padStart(2, '0')}`;
            if (sat.data.C1 !== undefined && nav.data[navIndex] !== undefined) {
                const {
                    e0,
                    sqrtA,
                    EK,
                    DeltaS,
                    VS,
                    aS,
                    TGD,
                    XSVK,
                    YSVK,
                    ZSVK,
                    Toc,
                } = nav.data[navIndex];
                let Sest = sat.data.C1;
                const time = obsData.time - Sest / this.c;
                const tK = time - (Toc.getUTCHours() * 3600 + Toc.getUTCMinutes() * 60 + Toc.getUTCSeconds());
                const deltaTR = this.CR * e0 * sqrtA * Math.sin(EK);
                const deltaT = DeltaS + tK * (VS + tK * aS) - TGD + deltaTR;
                Sest += deltaT * this.c;
                const AoR = -Sest * nav.omegaZ / this.c;
                let MoR = [
                    [0, 0, 0],
                    [0, 0, 0],
                    [0, 0, 1],
                ];
                MoR[1][1] = MoR[0][0] = cos(AoR);
                MoR[0][1] = sin(AoR);
                MoR[1][0] = -MoR[0][1];
                this.resSest.push(Sest);
                this.resX.push(multiply([
                    XSVK,
                    YSVK,
                    ZSVK,
                ], MoR))
            }
        });
        const length = this.resX.length;
        if (length < 4) {
            console.log('Недостаточно спутников');
            return;
        }
        let X = [...obsHeader.position, 0];
        let r = Array(length);
        let j = Array(length);
        let dSest = Array(length);
        while (true) {
            for (let i = 0; i < length; i++) {
                r[i] = sqrt(
                    pow(this.resX[i][0] - X[0], 2)
                    + pow(this.resX[i][1] - X[1], 2)
                    + pow(this.resX[i][2] - X[2], 2)
                );
                j[i] = [
                    (this.resX[i][0] - X[0]) / r[i],
                    (this.resX[i][1] - X[1]) / r[i],
                    (this.resX[i][2] - X[2]) / r[i],
                    1,
                ];
                dSest[i] = this.resSest[i] - r[i] - X[3];
            }
            let dX = multiply(multiply(inv(multiply(transpose(j), j)), transpose(j)), dSest);
            dX.forEach((val, i) => {
                X[i] -= val;
            });
            if (norm(dX.slice(0, 3)) < this.eps) {
                break;
            }
        }
        return {
            x: X[0],
            y: X[1],
            z: X[2],
            dx: X[0] - obsHeader.position[0],
            dy: X[1] - obsHeader.position[1],
            dz: X[2] - obsHeader.position[2],
        }
    },
}
