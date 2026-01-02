// src/App.tsx
import React, { useState, useEffect } from "react"; // Thêm useEffect
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import {
  Button,
  Layout,
  Card,
  Table,
  Typography,
  Spin,
  // Input, // Xoá Input cũ
  Select, // Thêm Select
  message,
  Row,
  Col,
} from "antd";
import {
  RobotOutlined,
  GoogleOutlined,
  // SearchOutlined, // Có thể bỏ nếu không dùng icon trong Select
} from "@ant-design/icons";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select; // Lấy Option từ Select

// Client ID của bạn
const GOOGLE_CLIENT_ID =
  "736527399714-uoqjoki4u564c739pcpnmbd7f8gpc0s5.apps.googleusercontent.com";

const SEODashboard = () => {
  const [token, setToken] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string>("");
  const [sites, setSites] = useState<any[]>([]); // State lưu danh sách site
  const [loadingSites, setLoadingSites] = useState(false); // Loading cho dropdown
  const [loading, setLoading] = useState(false); // Loading cho nút Analyze
  const [data, setData] = useState<any>(null);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => setToken(tokenResponse.access_token),
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  });

  // Effect: Tự động lấy danh sách site khi có token
  useEffect(() => {
    if (token) {
      fetchSites();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSites = async () => {
    setLoadingSites(true);
    try {
      const res = await axios.post("/.netlify/functions/list-sites", {
        accessToken: token,
      });
      setSites(res.data);
      // Tự chọn site đầu tiên nếu có để tiện cho user
      if (res.data && res.data.length > 0) {
        setSiteUrl(res.data[0].siteUrl);
      }
    } catch (error) {
      console.error(error);
      message.error("Không thể lấy danh sách website.");
    } finally {
      setLoadingSites(false);
    }
  };

  const handleAnalyze = async () => {
    if (!siteUrl) return message.error("Vui lòng chọn một Website");

    setLoading(true);
    try {
      const response = await axios.post("/.netlify/functions/analyze-seo", {
        accessToken: token,
        siteUrl: siteUrl,
        startDate: "2023-11-01",
        endDate: "2023-12-01",
      });
      setData(response.data);
      message.success("Phân tích hoàn tất!");
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi phân tích dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  // ... (Giữ nguyên columns và phần login UI cũ) ...
  const columns = [
    {
      title: "Keyword",
      dataIndex: "keys",
      key: "keys",
      render: (k: any) => k[0],
    },
    {
      title: "Clicks",
      dataIndex: "clicks",
      key: "clicks",
      sorter: (a: any, b: any) => a.clicks - b.clicks,
    },
    {
      title: "Impressions",
      dataIndex: "impressions",
      key: "impressions",
      sorter: (a: any, b: any) => a.impressions - b.impressions,
    },
    {
      title: "CTR",
      dataIndex: "ctr",
      key: "ctr",
      render: (v: number) => `${(v * 100).toFixed(2)}%`,
    },
    {
      title: "Position",
      dataIndex: "position",
      key: "position",
      render: (v: number) => v.toFixed(1),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {/* ... (Header giữ nguyên) ... */}
      <Header
        style={{
          background: "#fff",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <RobotOutlined
          style={{ fontSize: "24px", color: "#1890ff", marginRight: 10 }}
        />
        <Title level={4} style={{ margin: 0 }}>
          GSC + Groq Analyzer
        </Title>
      </Header>

      <Content
        style={{
          padding: "20px",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {!token ? (
          // ... (Phần Login giữ nguyên) ...
          <Card style={{ textAlign: "center", marginTop: 100 }}>
            <Title level={3}>Chào mừng bạn</Title>
            <Text>
              Đăng nhập Google để AI phân tích Search Console của bạn.
            </Text>
            <br />
            <br />
            <Button
              type="primary"
              icon={<GoogleOutlined />}
              onClick={() => login()}
              size="large"
            >
              Sign in with Google
            </Button>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 20 }}>
              <Row gutter={16} align="middle">
                <Col span={12}>
                  {/* Thay Input bằng Select */}
                  <Select
                    style={{ width: "100%" }}
                    placeholder="Chọn Website cần phân tích"
                    value={siteUrl}
                    onChange={(value) => setSiteUrl(value)}
                    loading={loadingSites}
                    showSearch
                    optionFilterProp="children"
                  >
                    {sites.map((site) => (
                      <Option key={site.siteUrl} value={site.siteUrl}>
                        {site.siteUrl} ({site.permissionLevel})
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <Button
                    type="primary"
                    onClick={handleAnalyze}
                    loading={loading}
                  >
                    Phân tích bằng AI
                  </Button>
                </Col>
              </Row>
            </Card>

            {/* ... (Phần hiển thị kết quả giữ nguyên) ... */}
            {loading && (
              <div style={{ textAlign: "center", padding: 50 }}>
                <Spin size="large" tip="Groq đang đọc data..." />
              </div>
            )}

            {data && (
              <Row gutter={24}>
                <Col span={12}>
                  <Card
                    title="💡 AI Insights (by Groq/Llama3)"
                    style={{ height: "100%" }}
                  >
                    <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                      <ReactMarkdown>{data.ai_analysis}</ReactMarkdown>
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="📊 Top Queries" style={{ height: "100%" }}>
                    <Table
                      dataSource={data.raw_data}
                      columns={columns}
                      rowKey={(r: any) => r.keys[0]}
                      pagination={{ pageSize: 5 }}
                      size="small"
                    />
                  </Card>
                </Col>
              </Row>
            )}
          </>
        )}
      </Content>
    </Layout>
  );
};

export default function App() {
  // ... (Giữ nguyên export App)
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <SEODashboard />
    </GoogleOAuthProvider>
  );
}
