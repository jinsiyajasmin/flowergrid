import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Collapse,
  Divider,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

const API_BASE = 'https://api.luna.flowergrid.co.uk';

export default function AdminSummary() {
  const [summaries, setSummaries] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/admin/summaries`)
      .then((res) => res.json())
      .then((data) => {
        setSummaries(Array.isArray(data) ? data : []);
      })
      .catch(console.error);
  }, []);

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
      {/* Page title */}
      <Typography variant="h4" fontWeight={600} mb={3}>
        Chat Summaries
      </Typography>

      {/* Table header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "260px 320px 200px 60px",
          px: 2,
          py: 1.5,
          fontSize: 13,
          fontWeight: 600,
          color: "#6B7280",
        }}
      >
        <div>NAME</div>
        <div>EMAIL</div>
        <div>CREATED</div>
        <div></div>
      </Box>

      <Divider />

      {/* Rows */}
      {summaries.map((item) => {
        const isOpen = openId === item._id;

        return (
          <Box key={item._id}>
            {/* Row */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "260px 320px 200px 60px",
                alignItems: "center",
                px: 2,
                py: 1.8,
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              {/* Name + Avatar */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar
                  src={item.avatar || ""}
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: "#E5E7EB",
                    color: "#111827",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {!item.avatar &&
                    (item.name?.[0]?.toUpperCase() || "U")}
                </Avatar>
                <Typography fontSize={14} fontWeight={500}>
                  {item.name || "Unknown"}
                </Typography>
              </Box>

              {/* Email */}
              <Typography fontSize={13} color="text.secondary">
                {item.email}
              </Typography>

              {/* Created date */}
              <Typography fontSize={13} color="text.secondary">
                {new Date(item.createdAt).toLocaleString()}
              </Typography>

              {/* Eye icon */}
              <IconButton onClick={() => toggle(item._id)}>
                {isOpen ? (
                  <VisibilityOffOutlinedIcon />
                ) : (
                  <VisibilityOutlinedIcon />
                )}
              </IconButton>
            </Box>

            {/* Summary (hidden until eye click) */}
            <Collapse in={isOpen}>
              <Box
                sx={{
                  px: 6,
                  py: 2.5,
                  bgcolor: "#FAFAFA",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <Typography
                  fontSize={14}
                  lineHeight={1.7}
                  sx={{ whiteSpace: "pre-wrap" }}
                >
                  {item.summary || "No summary available."}
                </Typography>
              </Box>
            </Collapse>
          </Box>
        );
      })}

      {summaries.length === 0 && (
        <Typography mt={4} color="text.secondary">
          No summaries found.
        </Typography>
      )}
    </Box>
  );
}
