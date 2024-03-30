type Commit = {
  /** commit SHA */
  id: string;
  /** e.g. "2024-03-29T13:35:05+02:00" */
  timestamp: string;
};

export type PushEvent = {
  ref: string;
  repository: {
    /** e.g. `my-repo` */
    name: string;

    /** e.g. `wolfie/my-repo` */
    full_name: string;
  };
  commits: Commit[];
  head_commit: Commit;
};
