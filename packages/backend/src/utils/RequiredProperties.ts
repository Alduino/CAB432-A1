type RequiredProperties<T, K extends keyof T> = T & Required<Pick<T, K>>;
export default RequiredProperties;
