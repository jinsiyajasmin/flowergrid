import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  useTheme,
  useMediaQuery,
  Chip,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import flowerGridLogo from "../assets/flower.png";
import PeopleIcon from "../assets/none.png";




const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://flowergrid-7mw2.vercel.app";

export default function AdminDashboard() {
  const [summaries, setSummaries] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const fetchSummaries = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/summaries`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Failed to fetch summaries");
        return;
      }

      const data = await res.json();
      const safeData = Array.isArray(data) ? data : [];
      setSummaries(safeData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSummaries();
    const interval = setInterval(fetchSummaries, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleViewSummary = (userEmail) => {
    const userSummaries = summariesByUser[userEmail] || [];
    const sorted = [...userSummaries].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setSelectedSummary(sorted);
    setDialogOpen(true);
  };


  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedSummary(null);
  };

  const summariesByUser = summaries.reduce((acc, item) => {
    if (!acc[item.email]) {
      acc[item.email] = [];
    }
    acc[item.email].push(item);
    return acc;
  }, {});

  const usersForTable = Object.values(summariesByUser).map(userSummaries =>
    userSummaries.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )[0]
  );

  const totalProspects = usersForTable.length;

  const growthPercentage = 7;

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#F5E4C8",
      display: "flex"
    }}>
      {!isMobile && (
        <Box sx={{
          width: 200,
          bgcolor: "#6B4A2A",
          color: "white",
          p: 4,
          display: "flex",
          flexDirection: "column",
        }}>

          <Box sx={{ mb: 6, textAlign: "center" }}>
            <Box
              component="img"
              src={flowerGridLogo}
              alt="Flower Grid"
              sx={{
                width: 50,
                mx: "auto",
                mb: 1,
              }}
            />
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 300,
                letterSpacing: 0.5,
                color: "#EFE6D6",
              }}
            >
              Flower Grid
            </Typography>
          </Box>


          <Box sx={{
            bgcolor: "#F5E4C8",
            color: "#6B4A2A",
            borderRadius: 2,
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            width: 400,
          }}>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 0.5,
              fontSize: 24,
            }}>
              <Box sx={{ width: 8, height: 8, bgcolor: "#6B5744", borderRadius: 0.5 }} />
              <Box sx={{ width: 8, height: 8, bgcolor: "#6B5744", borderRadius: 0.5 }} />
              <Box sx={{ width: 8, height: 8, bgcolor: "#6B5744", borderRadius: 0.5 }} />
              <Box sx={{ width: 8, height: 8, bgcolor: "#6B5744", borderRadius: 0.5 }} />
            </Box>
            <Typography fontWeight={500}>Dashboard</Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, p: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 1400, mx: "auto" }}>
          <Typography
            variant="h5"
            fontWeight={500}
            sx={{ mb: 3, color: "#6B5744" }}
          >
            Hello Samina!
          </Typography>

          <Card sx={{
            mb: 4,
            p: 3,
            bgcolor: "#EAD1A8",
            borderRadius: 3,
            boxShadow: "none",
            maxWidth: 300,
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>

              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  bgcolor: "#DFBF8E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
                  component="img"
                  src={PeopleIcon}
                  alt="People"
                  sx={{
                    width: 58,
                    height: 58,
                  }}
                />
              </Box>


              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "#6B5744", mb: 0.5 }}
                >
                  Total Prospects
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{ color: "#6B5744" }}
                >
                  {totalProspects}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TrendingUpIcon sx={{ fontSize: 16, color: "#4CAF50" }} />
                  <Typography variant="body2" sx={{ color: "#4CAF50" }}>
                    {growthPercentage}% this month
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Card>

          <Card sx={{
            borderRadius: 3,
            bgcolor: "#EAD1A8",
            boxShadow: "none",
            overflow: "hidden",
          }}>
            <Box sx={{ p: 3, pb: 2 }}>
              <Typography
                variant="h6"
                fontWeight={500}
                sx={{ color: "#6B5744" }}
              >
                All Prospects
              </Typography>
            </Box>

            {isMobile ? (
              <Box sx={{ p: 2 }}>
                {usersForTable.map((item) => (

                  <Card
                    key={item._id}
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: "#EAD1A8",
                      boxShadow: "none",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                      <Avatar src={item.avatar}>
                        {!item.avatar && item.name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600} sx={{ color: "#6B5744" }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#8B7355" }}>
                          {item.email}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleViewSummary(item.email)}

                      sx={{
                        bgcolor: "#6B5744",
                        color: "white",
                        textTransform: "none",
                        borderRadius: 2,
                        "&:hover": {
                          bgcolor: "#5A4936",
                        },
                      }}
                    >
                      View Summary
                    </Button>
                  </Card>
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{
                        color: "#6B5744",
                        fontWeight: 500,
                        bgcolor: "#EAD1A8",
                        borderBottom: "1px solid #D9CDB8",
                      }}>
                        Name
                      </TableCell>

                      <TableCell sx={{
                        color: "#6B5744",
                        fontWeight: 500,
                        bgcolor: "#EAD1A8",
                        borderBottom: "1px solid #D9CDB8",
                      }}>
                        Mail
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: "#6B5744",
                          fontWeight: 500,
                          bgcolor: "#EAD1A8",
                          borderBottom: "1px solid #D9CDB8",
                        }}
                      >
                        Summary
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersForTable.map((item, index) => (

                      <TableRow
                        key={item._id}
                        sx={{
                          bgcolor: index % 2 === 0 ? "#F5F1E8" : "#EAD1A8",
                          "&:hover": {
                            bgcolor: "#DFD3BF",
                          },
                        }}
                      >
                        <TableCell sx={{
                          borderBottom: "1px solid #D9CDB8",
                          color: "#6B5744",
                        }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar
                              src={item.avatar || ""}
                              sx={{ width: 32, height: 32 }}
                            >
                              {!item.avatar && item.name?.[0]}
                            </Avatar>
                            {item.name}
                          </Box>
                        </TableCell>

                        <TableCell sx={{
                          borderBottom: "1px solid #D9CDB8",
                          color: "#6B5744",
                        }}>
                          {item.email}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ borderBottom: "1px solid #D9CDB8" }}
                        >
                          <Button
                            variant="contained"
                            onClick={() => handleViewSummary(item.email)}

                            sx={{
                              bgcolor: "#6B5744",
                              color: "white",
                              textTransform: "none",
                              borderRadius: 2,
                              px: 3,
                              "&:hover": {
                                bgcolor: "#5A4936",
                              },
                            }}
                          >
                            View Summary
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {usersForTable.length === 0 && (

              <Box sx={{ py: 8, textAlign: "center" }}>
                <PeopleOutlineIcon sx={{ fontSize: 64, color: "#D9CDB8" }} />
                <Typography sx={{ color: "#8B7355" }}>
                  No prospects found
                </Typography>
              </Box>
            )}
          </Card>
        </Box>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: "#F5F1E8",
          }
        }}
      >
        <DialogTitle sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#6B5744",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar src={selectedSummary?.avatar || ""}>
              {!selectedSummary?.avatar && selectedSummary?.name?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {selectedSummary?.[0]?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedSummary?.email}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "white" }}>
          {selectedSummary?.map((item, index) => (
            <Box key={item._id} sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                sx={{ color: "#8B7355", display: "block", mb: 1 }}
              >
                {new Date(item.createdAt).toLocaleString()}
              </Typography>

              <Typography
                variant="body1"
                lineHeight={1.8}
                sx={{ color: "#6B5744" }}
              >
                {item.summary || "No summary available."}
              </Typography>

              {index !== selectedSummary.length - 1 && (
                <Box sx={{ my: 2, borderBottom: "1px solid #EAD1A8" }} />
              )}
            </Box>
          ))}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseDialog}
            variant="contained"
            sx={{
              bgcolor: "#6B5744",
              color: "white",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              "&:hover": {
                bgcolor: "#5A4936",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
