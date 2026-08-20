export interface CgvResponse<T> {
  statusCode: number;
  statusMessage: string;
  data: T[];
}

export interface DateItem {
  scnYmd: string;
}

export interface Schedule {
  siteNo: string;
  movNo: string;
  scnYmd: string;
  scnSseq: string;
  scnsNo: string;
  scnsNm: string;
  scnsrtTm: string;
  scnendTm: string;
  tcscnsGradCd: string;
  frSeatCnt: string;
  stcnt: string;
}
