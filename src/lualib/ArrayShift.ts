declare namespace table {
    function remove<T>(this: void, arr: T[], idx: number): T;
}
function __TS__ArrayShift<T>(this: void, arr: T[]): T {
    return table.remove(arr, 1);
}
