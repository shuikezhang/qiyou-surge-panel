# Surge 油价面板

独立重写的 Surge generic 脚本，不复制 cc63/Surge 原脚本（上游仓库未附可用许可证）。原模块依赖的 qiyoujiage.com 省页在 2026-10-28 仍展示 2026-09-26 的日期，并把已过期的 10 月 15 日调价提示显示在「今日油价」下。

## 数据与范围

- 31 省：从 HTTPS `www.icauto.com.cn/oil/price_{行政区划代码}_0.html` 获取省级 92/95 号汽油、0 号柴油，核对页面日期；该站不提供 98 号汽油，不编造。显示最近一次实际调价日期，不用动态的「今日」字样证明新价格。
- 城市参数如 `shanxi-3/xian`：沿用原站城市页（HTTP），核对页面自己的价格日期，显示 98 号汽油及非加密来源提示；它可能落后于省级数据。
- 没有可信数据时展示失败，而不是回退到无日期旧数据。油价仅供参考，以当地加油站报价为准。
- 默认山东 `shandong`；陕西是 `shanxi-3`，山西是 `shanxi`。省级与城市价不可混为一谈。

安装：Surge 导入本仓库 `main/QiYou.sgmodule` 的 Raw 链接，启用面板，按需改参数。若原模块仍在运行，先禁用原模块，避免两个同名 QiYou 面板冲突。刷新后在面板上核对「页面日期」；并非用户设备实测。

测试：`node --check QiYou.js && node test.js`。仅本地脚本及 HTTP 访问验证，不代表 Surge 真机、上游准确性或官方调价确认。原作者参考来源：https://github.com/cc63/Surge/tree/main/Module/Panel/QiYou/Moore 。
