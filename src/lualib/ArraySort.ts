declare namespace table {
    function sort<T>(this: void, arr: T[], compareFn?: (this: void, a: T, b: T) => boolean): void;
}
function __TS__ArraySort<T>(this: void, arr: T[], compareFn?: (a: T, b: T) => number): T[] {
    if (compareFn !== undefined) {
        table.sort(arr, (a, b) => compareFn(a, b) < 0);
    } else {
        table.sort(arr);
    }
    return arr;
}
