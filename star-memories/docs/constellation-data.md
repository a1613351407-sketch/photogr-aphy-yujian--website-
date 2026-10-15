# 十二星座排列

星座连线参考 d3-celestial 的 `data/constellations.lines.json`：
https://github.com/ofrohn/d3-celestial/blob/master/data/constellations.lines.json

这是回忆应用中的轮廓示意，不是观星导航或精确星位图。图形将赤经跨界展开、归一化，保留主要分支，并将每个星座简化或插值为 12 个可记录的位置；密集位置适当展开以便触摸。连接关系取自上述数据。

每条回忆仍使用原本的稳定 slot。切换星座只更换该 slot 的显示坐标，不会改写或删除数据库中的回忆，也不会限制回忆数量；更多记录继续分布在下一片星域。

星座选择属于当前设备上的显示偏好，存储于 localStorage 的 `xingji-constellation-v1`。记录与照片继续存储于 D1/R2。不可用或无效的本地偏好回退到自由星图。
